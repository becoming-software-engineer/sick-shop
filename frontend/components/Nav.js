import Link from 'next/link';
import { Mutation } from 'react-apollo';
import { TOGGLE_CART_MUTATION } from './Cart';
import NavStyles from './styles/NavStyles';
import User from './User';
import Signout from './Signout';
import CartCount from './CartCount';
import calcTotalItems from '../lib/calcTotalItems';

const Nav = () => (
  <User>
    {({ data: { me } }) => (
      <NavStyles>
        <Link href='/items'>
          <a>Shop</a>
        </Link>
        {me && (
          <>
            <Link href='/sell'>
              <a>sell</a>
            </Link>
            <Link href='/orders'>
              <a>orders</a>
            </Link>
            <Link href='/me'>
              <a>account</a>
            </Link>
            <Signout />
            <Mutation mutation={TOGGLE_CART_MUTATION}>
              {toggleCart => (
                <button onClick={toggleCart}>
                  My Cart
                  <CartCount count={calcTotalItems(me.cart)} />
                </button>
              )}
            </Mutation>
          </>
        )}
        {!me && (
          <Link href='/signup'>
            <a>signup</a>
          </Link>
        )}
      </NavStyles>
    )}
  </User>
);

export default Nav;
