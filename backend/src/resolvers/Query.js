const { forwardTo } = require('prisma-binding');
const { hasPermission } = require('../utils');

const Query = {
  // if yoga and prisma is exactly the same
  // we can forward it from yoga to prisma without creating as the comment below
  items: forwardTo('db'),
  item: forwardTo('db'),
  itemsConnection: forwardTo('db'),
  me(parent, args, ctx, info) {
    // check if there is a current user ID
    if (!ctx.request.userId) {
      return null;
    }
    return ctx.db.query.user(
      {
        where: { id: ctx.request.userId }
      },
      info
    );
  },
  async users(parent, args, ctx, info) {
    //1. check if are logged in
    if (!ctx.request.userId) {
      throw new Error('You must be logged in');
    }
    //2. check if user has permission to query all users
    hasPermission(ctx.request.user, ['ADMIN', 'PERMISSIONUPDATE']);

    //2. query all the users
    return ctx.db.query.users({}, info);
  },
  async order(parent, args, ctx, info) {
    //1. make sure they are logged in
    if (!ctx.request.userId) throw new Error('You are not logged in');
    //2. query the current order
    const order = await ctx.db.query.order(
      {
        where: { id: args.id }
      },
      info
    );
    //3. check if they have the permissions to se this order
    const ownsOrder = order.user.id === ctx.request.userId;
    const hasPermisionToSeeOrder = ctx.request.user.permissions.includes(
      'ADMIN'
    );
    if (!ownsOrder && !hasPermisionToSeeOrder)
      throw new Error('You are not allowed to see this order');
    //4. return the order
    return order;
  },
  async orders(parent, args, ctx, info) {
    const { userId } = ctx.request;
    if (!userId) throw new Error('You must be signed in');
    return ctx.db.query.orders(
      {
        where: {
          user: { id: userId }
        }
      },
      info
    );
  }

  //   async items(parent, args, ctx, info) {
  //     const items = await ctx.db.query.items();
  //     return items;
  //   }
};

module.exports = Query;
