/**
 * orders.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * Simple library to store and interact with orders and products.
 * These methods are using the Stripe Orders API, but we tried to abstract them
 * from the main code if you'd like to use your own order management system instead.
 */

'use strict';

const config = require('../config');
const twilio = require('twilio');
const MyRequestClient = require('./MyRequestClient');
const stripe = require('stripe')(config.stripe.secretKey);
stripe.setApiVersion(config.stripe.apiVersion);

// Create an order.
const createOrder = async (currency, items, email, shipping, extra) => {
  return await stripe.orders.create({
    currency,
    items,
    email,
    shipping,
    metadata: {
      status: 'created',
      marketing: extra.marketing,
      legal: extra.legal,
      dob: extra.dob,
      AgeVerified: 'NA',
      ReturnNumber: 'NA',
      DispatchNumber: 'NA',
      brochure: 'NA',
      DeviceId: 'NA',
    },
  });
};

// Retrieve an order by ID.
const retrieveOrder = async orderId => {
  return await stripe.orders.retrieve(orderId);
};

// Update an order.
const updateOrder = async (orderId, properties) => {
  return await stripe.orders.update(orderId, properties);
};

// List all products.
const listProducts = async () => {
  return await stripe.products.list();
};

// Retrieve a product by ID.
const retrieveProduct = async productId => {
  return await stripe.products.retrieve(productId);
};

// Validate that products exist.
const checkProducts = productList => {
  const validProducts = ['iqos', 'heets'];
  return productList.data.reduce((accumulator, currentValue) => {
    return (
      accumulator &&
      productList.data.length === 2 &&
      validProducts.includes(currentValue.id)
    );
  }, !!productList.data.length);
};

const twilioMessage = (name, number) => {
  const client = twilio(config.twilio.accountSid, config.twilio.authToken, {
    // Custom HTTP Client
    httpClient: new MyRequestClient(process.env.PROXY),
  });

  client.messages.create({
    to: number,
    from: '+447481347036',
    body:
      'Hi ' +
      name +
      ', this is to confirm we have received your order for an IQOS trial. We will do some age verification and send out your package ASAP. If you have any questions or want to follow up you can reach us on 0208 xxxxx or tryiqos.uk@pmi.com. ~ Thanks Emma',
  });
};
exports.orders = {
  create: createOrder,
  retrieve: retrieveOrder,
  update: updateOrder,
  sendMsg: twilioMessage,
};

exports.products = {
  list: listProducts,
  retrieve: retrieveProduct,
  exist: checkProducts,
};
