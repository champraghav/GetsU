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
