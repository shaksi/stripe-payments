/**
 * setup.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This is a one-time setup script for your server. It creates a set of fixtures,
 * namely products and SKUs, that can then used to create orders when completing the
 * checkout flow in the web interface.
 */

'use strict';

const config = require('../config');
const stripe = require('stripe')(config.stripe.secretKey);
stripe.setApiVersion(config.stripe.apiVersion);

module.exports = {
  running: false,
  run: async () => {
    if (this.running) {
      console.log('⚠️  Setup already in progress.');
    } else {
      this.running = true;
      this.promise = new Promise(async resolve => {
        // Create a few products and SKUs assuming they don't already exist.
        try {


          //create heets with mixed sku
          const heets = await stripe.products.create({
            id: 'heets',
            type: 'good',
            name: 'HEETS',
            attributes: ["type"],
          });
          await stripe.skus.create({
            id: 'heets-mix',
            product: 'heets',
            attributes: {type: '3 packs of HEETS (Amber, Turquoise, Yellow) Each pack contains 20 tobacco sticks'},
            price: 2400,
            currency: config.currency,
            inventory: {type: 'infinite'},
          });

           // Device
           const iqos = await stripe.products.create({
            id: 'iqos',
            type: 'good',
            name: 'IQOS device',
            attributes: ["colour"],
          });

          await stripe.skus.create({
            id: 'iqos-white',
            product: 'iqos',
            attributes: {colour: 'White'},
            price: 0,
            currency: config.currency,
            inventory: {type: 'infinite'},
          });

          await stripe.skus.create({
            id: 'iqos-navy',
            product: 'iqos',
            attributes: {colour: 'Navy'},
            price: 0,
            currency: config.currency,
            inventory: {type: 'infinite'},
          });

          console.log('Setup complete.');
          resolve();
          this.running = false;
        } catch (err) {
          if (err.message === 'Product already exists.') {
            console.log('⚠️  Products have already been registered.');
            console.log('Delete them from your Dashboard to run this setup.');
          } else {
            console.log('⚠️  An error occurred.', err);
          }
        }
      });
    }
    return this.promise;
  },
};
