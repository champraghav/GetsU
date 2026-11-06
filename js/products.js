/* ============================================================
   GETSU — PRODUCT CATALOGUE
   To add a product later: copy one block below, give it a new `id`,
   add its photo to images/products/, and fill in the fields.

   RULES THAT KEEP THE SITE HONEST
   · `nutrition` is optional. Leave it OUT until you hold verified
     figures (printed pack or lab report). The card then says the panel
     is coming instead of showing numbers. Declared nutrition on food is
     regulated in India — never publish a figure you cannot back up.
   · `highlights` are the short chips on the card. Only claim what the
     pack, the ingredient list or the nutrition panel supports.
   · `mrp` is the crossed-out "original" price. It is NOT shown on the
     site, because a discount is only honest against the real MRP
     printed on the pack. Tell the developer once you confirm each MRP
     and it can be switched on.
   ============================================================ */
const CATEGORIES = {
    breakfast: 'Breakfast',
    snacks: 'Snacks',
};

const PRODUCTS = [
    {
        id: 2,
        name: 'Protein Bar — Chocolate Delight',
        category: 'snacks',
        pack: '50 g bar',                       // "NET WT. 50g" on the pack
        price: 10,
        mrp: 129,
        highlights: ['20g protein per bar', 'Plant powered', 'No added sugar'],
        desc: 'Dates, almonds, cashews and peanut butter with pea protein and cocoa.',
        nutrition: { per: '50 g bar', kcal: 212, protein: 20, carbs: 18, sugar: 8, fat: 9, fibre: 4 },
        ingredients: 'Dates, almonds, cashews, peanut butter, pea protein isolate, cocoa powder, natural flavour, pink salt.',
        allergens: 'Almonds, cashews and peanuts',
        image: 'images/products/protein-bar-chocolate.jpg',
        imageBg: '#ECE7E4',                     // matches the photo's own background
    },
    {
        id: 9,
        name: 'Pancake Premix',
        category: 'breakfast',
        pack: '100 g pouch',                    // "NET WT. 100g" on the pack
        price: 379,
        mrp: 479,
        highlights: ['20g protein / 100g', '100% plant based', 'No refined sugar'],
        desc: 'Ragi, oats and sattu with pea protein and monk fruit. Just add milk and cook.',
        nutrition: { per: '35 g serving (3 scoops)', kcal: 129, protein: 7, carbs: 19, sugar: 2, fat: 2, fibre: 2 },
        ingredients: 'Ragi flour, oats flour, sattu (roasted gram flour), pea protein, monk fruit, baking powder, flaxseed powder, chia seeds, pink salt.',
        allergens: 'Oats (a cereal containing gluten)',
        image: 'images/products/pancake-premix.jpg',
        imageBg: '#E1D1C1',
    },
    {
        id: 1,
        name: 'High-Protein Oats',
        category: 'breakfast',
        pack: '',                               // add the printed net weight, e.g. '250 g pouch'
        price: 349,
        mrp: 449,
        highlights: ['Whey protein + almonds'],
        desc: 'Rolled oats with whey protein and almonds.',
        // Nutrition deliberately left out. The earlier figures declared 70 g of
        // nutrients inside a 45 g serving, which cannot be true. Add the real
        // panel here, in the same shape as the other products, and it will
        // appear on the card and in the product pop-up automatically:
        //   nutrition: { per: '45 g serving', kcal: 0, protein: 0, carbs: 0, sugar: 0, fat: 0, fibre: 0 },
        ingredients: 'Rolled oats, whey protein concentrate, almonds, cinnamon, natural vanilla.',
        allergens: 'Milk, almonds and oats (a cereal containing gluten)',
        image: '',                              // add e.g. 'images/products/high-protein-oats.jpg'
        imageBg: '',
    },
];
