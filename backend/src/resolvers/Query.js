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
  }

  //   async items(parent, args, ctx, info) {
  //     const items = await ctx.db.query.items();
  //     return items;
  //   }
};

module.exports = Query;
