const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { promisify } = require('util');
const { transport, makeANiceEmail } = require('../mail');
const { hasPermission } = require('../utils');

const Mutations = {
  async createItem(parent, args, ctx, info) {
    if (!ctx.request.userId) {
      throw new Error('You must be logged in to do that!');
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          //this is how to creaste a relationshop between item and user
          user: {
            connect: {
              id: ctx.request.userId
            }
          },
          ...args
        }
      },
      info
    );
    return item;
  },
  updateItem(parent, args, ctx, info) {
    //first take a copy of the updates
    const updates = { ...args };
    //remove the ID from update - it won't be updated
    delete updates.id;
    // run the update method
    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: { id: args.id }
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = { id: args.id };
    //1. find the item
    const item = await ctx.db.query.item({ where }, `{id title user {id}}`);
    //2. check if they own that item, or have the permission
    const ownsItem = item.user.id === ctx.request.userId;
    const hasPermissions = ctx.request.user.permissions.some(permission =>
      ['ADMIN', 'ITEMDELETE'].includes(permission)
    );
    if (!(ownsItem && hasPermission))
      throw new Error('You are not allowed to delete this item!!!');

    //4. delete item
    return ctx.db.mutation.deleteItem(
      {
        where
      },
      info
    );
  },
  async signup(parent, args, ctx, info) {
    //lowercase email
    args.email = args.email.toLowerCase();
    //hash password
    const password = await bcrypt.hash(args.password, 10);
    //Create the user in the database
    const user = await ctx.db.mutation.createUser(
      {
        data: { ...args, password, permissions: { set: ['USER'] } }
      },
      info
    );
    // creawte the JWT token for them
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    // set the jwt as a cookie on the response
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30 // 30 days
    });
    return user;
  },
  async signin(parent, { email, password }, ctx, info) {
    //1. Check if there is a user with that email
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No such user found for email ${email}`);
    }
    //2 check if their password if correct
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error('Invalid Password');
    }
    //3 generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);
    //4 set the cookie with the token
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 30
    });
    //5 return the user
    return user;
  },
  async signout(parent, args, ctx, info) {
    //clear the cookie
    ctx.response.clearCookie('token');
    return { message: 'Goodbye!' };
  },
  async requestReset(parent, args, ctx, info) {
    //1. check if this is a real user
    const user = await ctx.db.query.user({ where: { email: args.email } });
    if (!user) {
      throw new Error(`No such uyser found for email ${args.email}`);
    }
    //2. set a reset token and expiry on the user
    const randomBytesPromisefied = promisify(randomBytes);
    const resetToken = (await randomBytesPromisefied(20)).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    const res = await ctx.db.mutation.updateUser({
      where: { email: args.email },
      data: { resetToken, resetTokenExpiry }
    });
    //3. email them that reset token
    await transport.sendMail({
      from: 'test@sickfit.com',
      to: user.email,
      subject: 'Your password reset token',
      html: makeANiceEmail(
        `Your password token is here!! \n\n <a href="${
          process.env.FRONTEND_URL
        }/reset?resetToken=${resetToken}">Click Here to Reset</a>`
      )
    });
    //4. return the message
    return { message: 'Thanks' };
  },
  async reset(parent, args, ctx, info) {
    //1. check if password match
    if (args.password !== args.confirmPassword) {
      throw new Error("Yo Password don't match!");
    }
    //2. check if its a legit reset token
    //3. check if its expired
    const [user] = await ctx.db.query.users({
      where: {
        resetToken: args.resetToken,
        resetTokenExpiry_gte: Date.now() - 3600000
      }
    });
    if (!user) {
      throw new Error('This token is invalid or expired!');
    }
    //4. hash new password
    const password = await bcrypt.hash(args.password, 10);
    //5. save new password to the user and remove old resetToken
    const updatedUser = await ctx.db.mutation.updateUser({
      where: { email: user.email },
      data: {
        password: password,
        resetToken: null,
        resetTokenExpiry: null
      }
    });
    //6. generate JWT
    const token = jwt.sign({ userId: updatedUser.id }, process.env.APP_SECRET);
    //7. set the JWT cookie
    ctx.response.cookie('token', token, {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
    //8. return the new user
    return updatedUser;
    //9
  },

  async updatePermissions(parent, args, ctx, info) {
    //1. check if they are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in to udpate permissions');
    }
    //2. query the current user
    const currentUser = await ctx.db.query.user(
      {
        where: {
          id: ctx.request.userId
        }
      },
      info
    );
    //3. check if they have permissions to do this
    hasPermission(currentUser, ['ADMIN', 'PERMISSIONSUPDATE']);
    //4. update ther permissions
    return ctx.db.mutation.updateUser(
      {
        data: {
          permissions: {
            set: args.permissions
          }
        },
        where: {
          id: args.userId
        }
      },
      info
    );
  },
  async addToCart(parent, args, ctx, info) {
    //1. make sure they are signed in
    if (!ctx.request.userId)
      throw new Error('You must be logged in to add items to your cart');
    const { userId } = ctx.request;
    //2. query the users current cart
    const [existingCartItem] = await ctx.db.query.cartItems({
      where: {
        user: { id: userId },
        item: { id: args.id }
      }
    });
    //3. check if theat item is alreadu in their cart and increment by 1
    if (existingCartItem) {
      console.log('This item is already in their cart');
      return ctx.db.mutation.updateCartItem(
        {
          where: { id: existingCartItem.id },
          data: { quantity: existingCartItem.quantity + 1 }
        },
        info
      );
    }
    //4. if its not, create a new cartItem for that user
    return ctx.db.mutation.createCartItem(
      {
        data: {
          user: {
            connect: { id: userId }
          },
          item: {
            connect: { id: args.id }
          }
        }
      },
      info
    );
  },
  async removeFromCart(parent, args, ctx, info) {
    //1. find the cart item
    const cartItem = await ctx.db.query.cartItem(
      {
        where: {
          id: args.id
        }
      },
      `{id, user{ id }}`
    );
    //2. make sure we found an item
    if (!cartItem) throw new Error('No CartItem Found!');
    //3. make sure they own that cart item
    if (cartItem.user.id !== ctx.request.userId)
      throw new Error('Cheting huhhhhh!!!!');
    //4. delete that cart item
    return ctx.db.mutation.deleteCartItem(
      {
        where: { id: args.id }
      },
      info
    );
  }
};

module.exports = Mutations;
