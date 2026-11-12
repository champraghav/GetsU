/* ============================================================
   GETSU — BUSINESS SETTINGS
   This is the ONE file to edit for contact details and payments.
   Change the text between the quotes, save, and upload.

   The website adapts to whatever is filled in, so it never promises
   something that isn't switched on:
     · whatsappNumber blank  → no WhatsApp button; orders go by email
     · razorpayKeyId blank   → "Pay online" is hidden at checkout
     · upiVpa blank          → "Pay by UPI" is hidden at checkout

   Only "Pay online" (Razorpay) can show the customer "Payment successful,
   order confirmed" by itself, with a bill. A plain UPI QR pays your UPI ID
   directly and the website never hears about it, so once razorpayKeyId is
   filled in, the plain "Pay by UPI" QR is hidden (Razorpay takes UPI too).
   ============================================================ */
const CONFIG = {
    brand: 'GetsU',

    // Where order emails and customer messages go.
    businessEmail: 'teamgetsu.31@gmail.com',

    // Business WhatsApp number in full international format:
    // country code + number, no "+", no spaces.  Example: '919876543210'
    whatsappNumber: '',

    // Razorpay "Key ID" from  Dashboard → Account & Settings → API Keys.
    // It starts with rzp_live_ (or rzp_test_ while testing).
    // This is the PUBLIC key and is meant to be here.
    // NEVER paste the "Key Secret" anywhere in this website.
    razorpayKeyId: '',

    // Your UPI ID, and the name customers see in their UPI app.
    // Used for the plain UPI QR, which shows only while razorpayKeyId is blank.
    upiVpa: 'soniraghav350-1@oksbi',
    upiPayeeName: 'GetsU',

    // Printed in the footer. Food businesses in India must show this.
    fssaiLicence: '21526031000596',

    // Printed on the bill customers receive after paying online. Leave a
    // line blank and it is simply left off the bill.
    legalName: '',          // your registered business name, e.g. 'GetsU Foods Pvt Ltd'
    businessAddress: '',    // full postal address of the business
    gstin: '',              // your 15-character GST number, if you are GST-registered

    // Tax added on top of the product prices at checkout (0.05 = 5%).
    // GST differs by product, so confirm the right rate with your CA.
    taxRate: 0.05,

    // Most of one product a customer can add in a single order.
    maxQty: 20,
};

// Public by design: this identifies the database, it does not unlock it.
// Access is controlled by the rules set inside the Firebase console.
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCvRzjv-IEks_gAvCCA70-mDUnLD8wCrjU',
    authDomain: 'getsu-a30a8.firebaseapp.com',
    databaseURL: 'https://getsu-a30a8-default-rtdb.firebaseio.com',
    projectId: 'getsu-a30a8',
    storageBucket: 'getsu-a30a8.firebasestorage.app',
    messagingSenderId: '431826507595',
    appId: '1:431826507595:web:3f63c64a584b7f3b283ace',
};
