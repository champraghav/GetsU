# Product photos

Real photos go here. A product without one shows a designed stand-in, so
nothing breaks while a photo is missing — but a real photo sells far better.

Currently photographed: `protein-bar-chocolate.jpg`, `pancake-premix.jpg`.
Still needs one: **High-Protein Oats**.

## Adding or changing a photo

1. Save the image in this folder (JPG, ideally under 300 KB).
2. Open `js/products.js`, find the product, and set:

   ```js
   image: 'images/products/high-protein-oats.jpg',
   imageBg: '#E8E0D4',   // the photo's own background colour, so it blends in
   ```

   (To find `imageBg`, use any colour-picker on the photo's edge.)
3. Commit and push. The card, cart and product pop-up all pick it up.

## Adding a whole new product

Copy a block in `js/products.js` and give it a new `id`. Notes:

- `category` must be `breakfast` or `snacks`. To add another, add it to
  `CATEGORIES` at the top of that file, and give it an icon in `js/app.js`.
- `nutrition` is **optional**. Leave it out until you have verified figures
  (printed pack or lab report). The card then says the panel is coming.
  Declared nutrition on food is regulated, so never publish a number you
  cannot back up.
- `highlights` are the short chips on the card. Claim only what the pack,
  ingredient list or nutrition panel supports. A protein figure must say
  whether it is per serving or per 100 g.
- `allergens` must list everything in the ingredients that is a declared
  allergen (milk, nuts, peanuts, soy, gluten-containing cereals such as oats…).
- Don't add "Best Seller" or "Popular" labels until sales really support
  them. The site publicly promises not to invent customer signals.
- `mrp` (the crossed-out price) is not displayed. Show a discount only
  against the real MRP printed on the pack.
