# GetsU — website

A small, fast, static shop for GetsU, hosted free on GitHub Pages.
No server, no build step: the files in this repository *are* the website.

## Where things are

| You want to change…                              | Edit this file          |
|--------------------------------------------------|-------------------------|
| WhatsApp number, Razorpay key, UPI ID, email, GST rate | `js/config.js`    |
| Products, prices, nutrition, ingredients         | `js/products.js`        |
| Product photos                                   | `images/products/`      |
| Words on the page (hero, About, FAQ)             | `index.html`            |
| Colours and fonts                                | `css/style.css` (top)   |
| How the cart, checkout and payment behave        | `js/app.js`             |

Everything a non-developer should ever touch is in `js/config.js` and
`js/products.js`, and both explain themselves in comments.

## The ordering flow

1. **Cart page** (`#/cart`) — review, change quantities, remove items.
2. **Place your order** (`#/checkout`) — delivery details, then choose how to pay:
   - **Pay online** (Razorpay) — appears once `razorpayKeyId` is set.
   - **Pay by UPI** — QR code with the exact amount; appears when `upiVpa` is set.
   - **Send the order, pay after we confirm** — opens WhatsApp (or email) with the
     order written out for the customer to send.
3. **Order page** (`#/order`) — pay or send. Until a payment goes through there is
   always a **Cancel payment** button, which cancels the order and leaves the cart
   exactly as it was.

## Your bill

The moment an online payment succeeds, the order page shows an itemised **payment
receipt** by itself: bill number, date and time, what was bought (quantity, rate,
amount), subtotal, tax, total paid, the Razorpay payment ID, who it was billed to
and who sold it. **Print / Save as PDF** gives a clean black-on-white A4 page named
after the bill number.

- It is a *receipt*, not a GST tax invoice. A tax invoice needs a GSTIN, product
  codes and a tax split, which this site does not hold. Fill in `legalName`,
  `businessAddress` and `gstin` in `js/config.js` and they are printed on the bill.
- The customer's details are not stored (see below), so a bill cannot be shown again
  after the page is refreshed. The page tells the customer to print or save it.
- Only a successful *online* payment produces a bill. A UPI "I've paid" tap is just a
  claim, so it does not.

## Testing with dummy money (Razorpay test mode)

No real money moves in test mode.

1. In the Razorpay dashboard switch **Test Mode** on, go to Account & Settings →
   API Keys and generate a **test** key. The Key ID starts `rzp_test_`.
2. Put it in `js/config.js` as `razorpayKeyId`, publish, and place an order.
3. Pay with Razorpay's published test details (check their "test card details" page,
   as these can change): card `4111 1111 1111 1111`, any future expiry, any CVV;
   UPI `success@razorpay` to succeed or `failure@razorpay` to fail; or any
   netbanking bank, then choose Success or Failure.
4. On success the bill appears. The payment is listed in the dashboard under
   Transactions while Test Mode is on.
5. Also try closing the window and a failing payment, to see Try again and
   **Cancel payment**.

Before going live, swap in the **live** key (`rzp_live_…`) and check the dashboard's
payment-capture setting is *automatic*. Payments made like this are otherwise only
"authorised", and Razorpay refunds an authorised payment that is never captured.

## Things to know

- **"Paid" is not proof.** This is a website with no server, so the browser only
  *reports* that Razorpay's window said yes. Always check the money in your
  Razorpay dashboard (or UPI app) before you ship.
- **Customer details are never stored.** Name, phone and address exist only in the
  open page, long enough to open the payment window or build the message the
  customer sends. They are not saved in the browser or in the database. For online
  payments they are passed to Razorpay with the payment, so you can see where to ship
  in your Razorpay dashboard.
- **Never put the Razorpay *Key Secret* anywhere in this site.** Only the public
  *Key ID* (`rzp_live_…`) belongs in `js/config.js`.

## Going live

GitHub Pages serves the `main` branch. Merge your changes into `main`; the site
updates a minute or two later.

## Credits

Headline font: **Fira Sans** (SIL Open Font License), self-hosted in `fonts/`.
