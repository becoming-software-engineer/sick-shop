import React, { Component } from 'react';
import { Mutation } from 'react-apollo';
import Form from './styles/Form';
import gql from 'graphql-tag';
import Router from 'next/router';
import formatMoney from '../lib/formatMoney';
import Error from './ErrorMessage';

const CREATE_ITEM_MUTATION = gql`
  mutation CREATE_ITEM_MUTATION(
    $title: String!
    $description: String!
    $price: Int!
    $image: String
    $largeImage: String
  ) {
    createItem(
      title: $title
      description: $description
      price: $price
      image: $image
      largeImage: $largeImage
    ) {
      id
    }
  }
`;

class CreateItem extends Component {
  state = {
    title: '',
    description: '',
    image: '',
    largeImage: '',
    price: ''
  };

  handleChange = e => {
    //handleChange must be an arrou function to have access to "this"
    // without arrow function we would need to create super and bind
    const { name, type, value } = e.target;
    const val = type == ' number' ? parseFloat(value) : value;

    this.setState({ [name]: val });
  };

  uploadFile = async e => {
    const files = e.target.files;
    const data = new FormData();
    data.append('file', files[0]);
    data.append('upload_preset', 'sickfits');

    const res = await fetch(
      'https://api.cloudinary.com/v1_1/bse/image/upload',
      { method: 'POST', body: data }
    );
    const file = await res.json();
    console.log(file);

    this.setState({
      image: file.secure_url,
      largeImage: file.eager[0].secure_url
    });
  };

  render() {
    return (
      <Mutation mutation={CREATE_ITEM_MUTATION} variables={this.state}>
        {(createItem, { loading, error, called, data }) => (
          // wonderfull of Apollo
          // give us the loading, error, called and data
          <Form
            onSubmit={async e => {
              //spot the form from submitting
              e.preventDefault();
              // call the mutation
              const res = await createItem();
              //change them to the single item page
              console.log(res);
              Router.push({
                pathname: '/item',
                query: { id: res.data.createItem.id }
              });
            }}
          >
            <Error error={error} />

            <fieldset disable={loading ? 1 : 0} aria-busy={loading ? 1 : 0}>
              <label htmlFor='file'>
                Image
                <input
                  type='file'
                  id='file'
                  name='file'
                  placeholder='file'
                  onChange={this.uploadFile}
                  required
                />
                {this.state.image && (
                  <img
                    src={this.state.image}
                    width='200'
                    alt='Upload Preview'
                  />
                )}
              </label>
              <label htmlFor='title'>
                Title
                <input
                  type='text'
                  id='title'
                  name='title'
                  placeholder='title'
                  value={this.state.title}
                  onChange={this.handleChange}
                  required
                />
              </label>
              <label htmlFor='price'>
                Price
                <input
                  type='number'
                  id='price'
                  name='price'
                  placeholder='price'
                  value={this.state.price}
                  onChange={this.handleChange}
                  required
                />
              </label>
              <label htmlFor='description'>
                Description
                <textarea
                  type='number'
                  id='description'
                  name='description'
                  placeholder='Enter a description'
                  value={this.state.description}
                  onChange={this.handleChange}
                  required
                />
              </label>
              <button type='submit'>Submit</button>
            </fieldset>
          </Form>
        )}
      </Mutation>
    );
  }
}

export default CreateItem;
export { CREATE_ITEM_MUTATION };
