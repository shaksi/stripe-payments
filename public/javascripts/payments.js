/**
 * payments.js
 * Stripe Payments Demo. Created by Romain Huet (@romainhuet).
 *
 * This modern JavaScript file handles the checkout process using Stripe.
 *
 * 1. It shows how to accept card payments with the `card` Element, and
 * the `paymentRequestButton` Element for Payment Request and Apple Pay.
 * 2. It shows how to use the Stripe Sources API to accept non-card payments,
 * such as iDEAL, SOFORT, SEPA Direct Debit, and more.
 */

(async () => {
  'use strict';

  const decodeEntities = (function() {
    // this prevents any overhead from creating the object each time
    let element = document.createElement('div');

    function decodeHTMLEntities(str) {
      if (str && typeof str === 'string') {
        // strip script/html tags
        str = str.replace(/<script[^>]*>([\S\s]*?)<\/script>/gim, '');
        str = str.replace(/<\/?\w(?:[^"'>]|"[^"]*"|'[^']*')*>/gim, '');
        element.innerHTML = str;
        str = element.textContent;
        element.textContent = '';
      }

      return str;
    }

    return decodeHTMLEntities;
  })();
  const getQueryVariable = variable => {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split('=');
      if (pair[0] == variable) {
        return pair[1];
      }
    }
    return false;
  };
  const dob = getQueryVariable('dob');
  const colour = getQueryVariable('colour');
  const promo = getQueryVariable('promo');

  if (dob == '' || colour == '') {
    window.location.replace('/');
  }
  //set the dob value from url
  document.getElementById('dob').value = dob.replace(
    new RegExp('%2F', 'g'),
    '/'
  );

  // Retrieve the configuration for the store.
  const config = await store.getConfig();
  await store.displayOrderSummary(colour);
  // Create references to the main form and its submit button.
  const form = document.getElementById('payment-form');
  const submitButton = form.querySelector('button[type=submit]');

  /**
   * Setup Stripe Elements.
   */

  // Create a Stripe client.
  const stripe = Stripe(config.stripePublishableKey);

  // Create an instance of Elements.
  const elements = stripe.elements();

  // Prepare the options for Elements to be styled accordingly.
  const elementsOptions = {
    style: {
      base: {
        iconColor: '#666ee8',
        color: '#31325f',
        fontWeight: 400,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
        fontSmoothing: 'antialiased',
        fontSize: '15px',
        '::placeholder': {
          color: '#aab7c4',
        },
        ':-webkit-autofill': {
          color: '#666ee8',
        },
      },
    },
  };

  /**
   * Implement a Stripe Card Element that matches the look-and-feel of the app.
   *
   * This makes it easy to collect debit and credit card payments information.
   */

  // Create a Card Element and pass some custom styles to it.
  const card = elements.create('card', elementsOptions);

  // Mount the Card Element on the page.
  card.mount('#card-element');

  // Monitor change events on the Card Element to display any errors.
  card.addEventListener('change', ({error}) => {
    const cardErrors = document.getElementById('card-errors');
    if (error) {
      cardErrors.textContent = error.message;
      cardErrors.classList.add('visible');
    } else {
      cardErrors.classList.remove('visible');
    }
    // Re-enable the Pay button.
    submitButton.disabled = false;
  });

  /**
   * Implement a Stripe Payment Request Button Element.
   *
   * This automatically supports the Payment Request API (already live on Chrome),
   * as well as Apple Pay on the Web on Safari.
   * When of these two options is available, this element adds a “Pay” button on top
   * of the page to let users pay in just a click (or a tap on mobile).
   */

  // Make sure all data is loaded from the store to compute the order amount.
  await store.loadProducts();

  /**
   * Handle the form submission.
   *
   * This creates an order and either sends the card information from the Element
   * alongside it, or creates a Source and start a redirect to complete the purchase.
   *
   * Please note this form is not submitted when the user chooses the "Pay" button
   * or Apple Pay since they provide name and shipping information directly.
   */

  // Listen to changes to the user-selected country.
  form
    .querySelector('select[name=country]')
    .addEventListener('change', event => {
      event.preventDefault();
      const country = event.target.value;
      const zipLabel = form.querySelector('label.zip');
      // Only show the state input for the United States.
      zipLabel.parentElement.classList.toggle('with-state', country === 'US');
      // Update the ZIP label to make it more relevant for each country.
      form.querySelector('label.zip span').innerText =
        country === 'US'
          ? 'ZIP'
          : country === 'UK'
            ? 'Postcode'
            : 'Postal Code';
      event.target.parentElement.className = `field ${country}`;
      showRelevantPaymentMethods(country);
    });

  // Submit handler for our payment form.
  form.addEventListener('submit', async event => {
    event.preventDefault();

    // Retrieve the user information from the form.
    const payment = form.querySelector('input[name=payment]:checked').value;
    const name = form.querySelector('input[name=name]').value;
    const phone = form.querySelector('input[name=phone]').value;
    const country = form.querySelector('select[name=country] option:checked')
      .value;
    const email = form.querySelector('input[name=email]').value;
    const shipping = {
      name,
      phone,
      address: {
        line1: form.querySelector('input[name=address]').value,
        city: form.querySelector('input[name=city]').value,
        postal_code: form.querySelector('input[name=postal_code]').value,
        state: form.querySelector('input[name=state]').value,
        country,
      },
    };

    const extra = {
      marketing: form.querySelector('input[name=marketing]').checked,
      legal: form.querySelector('input[name=legal]').checked,
      dob: form.querySelector('input[name=dob]').value,
      promo: promo,
    };
    // Disable the Pay button to prevent multiple click events.
    submitButton.disabled = true;

    // Create the order using the email and shipping information from the form.
    const order = await store.createOrder(
      config.currency,
      store.getOrderItems(),
      email,
      shipping,
      extra
    );

    if (payment === 'card') {
      // Create a Stripe source from the card information and the owner name.
      const {source} = await stripe.createSource(card, {
        owner: {
          name,
        },
      });
      await handleOrder(order, source);
    } else {
      // Prepare all the Stripe source common data.
      const sourceData = {
        type: payment,
        amount: order.amount,
        currency: order.currency,
        owner: {
          name,
          email,
        },
        redirect: {
          return_url: window.location.href,
        },
        statement_descriptor: 'Stripe Payments Demo',
        metadata: {
          order: order.id,
        },
      };

      // Add extra source information which are specific to a payment method.
      switch (payment) {
        case 'sepa_debit':
          // SEPA Debit: Pass the IBAN entered by the user.
          sourceData.sepa_debit = {
            iban: form.querySelector('input[name=iban]').value,
          };
          break;
        case 'sofort':
          // SOFORT: The country is required before redirecting to the bank.
          sourceData.sofort = {
            country,
          };
          break;
        case 'ach_credit_transfer':
          // ACH Bank Transfer: Only supports USD payments, edit the default config to try it.
          // In test mode, we can set the funds to be received via the owner email.
          sourceData.owner.email = `amount_${order.amount}@example.com`;
          break;
      }

      // Create a Stripe source with the common data and extra information.
      const {source, error} = await stripe.createSource(sourceData);
      await handleOrder(order, source, error);
    }
  });

  // Handle the order and source activation if required
  const handleOrder = async (order, source, error = null) => {
    const mainElement = document.getElementById('main');
    const checkoutElement = document.getElementById('checkout');
    const confirmationElement = document.getElementById('confirmation');

    if (error) {
      mainElement.classList.remove('processing');
      mainElement.classList.remove('receiver');
      confirmationElement.querySelector('.error-message').innerText =
        error.message;
      mainElement.classList.add('error');
    }
    switch (order.metadata.status) {
      case 'created':
        switch (source.status) {
          case 'chargeable':
            submitButton.textContent = 'Processing Order…';
            const response = await store.payOrder(order, source);
            await handleOrder(response.order, response.source);
            break;
          case 'failed':
          case 'canceled':
            // Authentication failed, offer to select another payment method.
            break;
          default:
            // Order is received, pending payment confirmation.
            break;
        }
        break;

      case 'pending':
        // Success! Now waiting for payment confirmation. Update the interface to display the confirmation screen.
        mainElement.classList.remove('processing');
        // Update the note about receipt and shipping (the payment is not yet confirmed by the bank).
        confirmationElement.querySelector('.note').innerText =
          'We’ll send your receipt and ship your items as soon as your payment is confirmed.';
        mainElement.classList.add('success');
        break;

      case 'failed':
        checkoutElement.classList.remove('visible');
        // Payment for the order has failed.
        mainElement.classList.remove('success');
        mainElement.classList.remove('processing');
        mainElement.classList.remove('receiver');
        mainElement.classList.add('error');
        break;

      case 'paid':
      case 'captured':
        //hide the checkout form
        checkoutElement.classList.remove('visible');
        // Success! Payment is confirmed. Update the interface to display the confirmation screen.
        mainElement.classList.remove('processing');
        mainElement.classList.remove('receiver');
        // Update the note about receipt and shipping (the payment has been fully confirmed by the bank).
        confirmationElement.querySelector('.note').innerText =
          'We will send the confirmation to your email in the next few minutes, and your items will be on their way shortly.';
        mainElement.classList.add('success');
        break;
    }
  };

  /**
   * Monitor the status of a source after a redirect flow.
   *
   * This means there is a `source` parameter in the URL, and an active order.
   * When this happens, we'll monitor the status of the order and present real-time
   * information to the user.
   */

  const pollOrderStatus = async (
    orderId,
    timeout = 30000,
    interval = 500,
    start = null
  ) => {
    start = start ? start : Date.now();
    const endStates = ['paid', 'failed'];
    // Retrieve the latest order status.
    const order = await store.getOrderStatus(orderId);
    await handleOrder(order, {status: null});
    if (
      !endStates.includes(order.metadata.status) &&
      Date.now() < start + timeout
    ) {
      // Not done yet. Let's wait and check again.
      setTimeout(pollOrderStatus, interval, orderId, timeout, interval, start);
    } else {
      if (!endStates.includes(order.metadata.status)) {
        // Status has not changed yet. Let's time out.
        console.warn(new Error('Polling timed out.'));
      }
    }
  };

  const orderId = store.getActiveOrderId();
  const mainElement = document.getElementById('main');
  if (orderId && window.location.search.includes('source')) {
    // Update the interface to display the processing screen.
    mainElement.classList.add('success', 'processing');

    // Poll the backend and check for an order status.
    // The backend updates the status upon receiving webhooks,
    // specifically the `source.chargeable` and `charge.succeeded` events.
    pollOrderStatus(orderId);
  } else {
    // Update the interface to display the checkout form.
    mainElement.classList.add('checkout');
  }

  /**
   * Display the relevant payment methods for a selected country.
   */

  // List of relevant countries for the payment methods supported in this demo.
  // Read the Stripe guide: https://stripe.com/payments/payment-methods-guide
  const paymentMethods = {
    ach_credit_transfer: {
      name: 'Bank Transfer',
      flow: 'receiver',
      countries: ['US'],
    },
    alipay: {
      name: 'Alipay',
      flow: 'redirect',
      countries: ['CN', 'HK', 'SG', 'JP'],
    },
    bancontact: {
      name: 'Bancontact',
      flow: 'redirect',
      countries: ['BE'],
    },
    card: {
      name: 'Card',
      flow: 'none',
    },
    eps: {
      name: 'EPS',
      flow: 'redirect',
      countries: ['AT'],
    },
    ideal: {
      name: 'iDEAL',
      flow: 'redirect',
      countries: ['NL'],
    },
    giropay: {
      name: 'Giropay',
      flow: 'redirect',
      countries: ['DE'],
    },
    multibanco: {
      name: 'Multibanco',
      flow: 'receiver',
      countries: ['PT'],
    },
    sepa_debit: {
      name: 'SEPA Direct Debit',
      flow: 'none',
      countries: ['FR', 'DE', 'ES', 'BE', 'NL', 'LU', 'IT', 'PT', 'AT', 'IE'],
    },
    sofort: {
      name: 'SOFORT',
      flow: 'redirect',
      countries: ['DE', 'AT'],
    },
    wechat: {
      name: 'WeChat',
      flow: 'none',
      countries: ['CN', 'HK', 'SG', 'JP'],
    },
  };

  // Update the main button to reflect the payment method being selected.
  const updateButtonLabel = paymentMethod => {
    let amount = store.formatPrice(store.getOrderTotal(), config.currency);
    let name = paymentMethods[paymentMethod].name;
    let label = `Place Order`;
    if (paymentMethod !== 'card') {
      label = `Pay ${amount} with ${name}`;
    }
    if (paymentMethod === 'wechat') {
      label = `Generate QR code to pay ${amount} with ${name}`;
    }
    submitButton.innerText = label;
  };

  // Show only the payment methods that are relevant to the selected country.
  const showRelevantPaymentMethods = country => {
    if (!country) {
      country = form.querySelector('select[name=country] option:checked').value;
    }
    const paymentInputs = form.querySelectorAll('input[name=payment]');
    for (let i = 0; i < paymentInputs.length; i++) {
      let input = paymentInputs[i];
      input.parentElement.classList.toggle(
        'visible',
        input.value === 'card' ||
          paymentMethods[input.value].countries.includes(country)
      );
    }

    // Hide the tabs if card is the only available option.
    const paymentMethodsTabs = document.getElementById('payment-methods');
    paymentMethodsTabs.classList.toggle(
      'visible',
      paymentMethodsTabs.querySelectorAll('li.visible').length > 1
    );

    // Check the first payment option again.
    paymentInputs[0].checked = 'checked';
    form.querySelector('.payment-info.card').classList.add('visible');
    // form.querySelector('.payment-info.sepa_debit').classList.remove('visible');
    // form.querySelector('.payment-info.wechat').classList.remove('visible');
    // form.querySelector('.payment-info.redirect').classList.remove('visible');
    updateButtonLabel(paymentInputs[0].value);
  };

  // Listen to changes to the payment method selector.
  for (let input of document.querySelectorAll('input[name=payment]')) {
    input.addEventListener('change', event => {
      event.preventDefault();
      const payment = form.querySelector('input[name=payment]:checked').value;
      const flow = paymentMethods[payment].flow;

      // Update button label.
      updateButtonLabel(event.target.value);

      // Show the relevant details, whether it's an extra element or extra information for the user.
      form
        .querySelector('.payment-info.card')
        .classList.toggle('visible', payment === 'card');
      form
        .querySelector('.payment-info.sepa_debit')
        .classList.toggle('visible', payment === 'sepa_debit');
      form
        .querySelector('.payment-info.wechat')
        .classList.toggle('visible', payment === 'wechat');
      form
        .querySelector('.payment-info.redirect')
        .classList.toggle('visible', flow === 'redirect');
      form
        .querySelector('.payment-info.receiver')
        .classList.toggle('visible', flow === 'receiver');
      document
        .getElementById('card-errors')
        .classList.remove('visible', payment !== 'card');
    });
  }

  // Select the default country from the config on page load.
  const countrySelector = document.getElementById('country');
  countrySelector.querySelector(`option[value=${config.country}]`).selected =
    'selected';
  countrySelector.className = `field ${config.country}`;

  // Trigger the method to show relevant payment methods on page load.
  showRelevantPaymentMethods();
})();
