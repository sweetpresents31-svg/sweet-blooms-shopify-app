const luxuryPackages = [
  {
    title: 'The Essential Luxury Room Package',
    price: 350,
    image: 'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-balloon-room-1.jpg?v=1789132960',
    variantId: '50182941081738',
    setup: '~2–2.5 hours',
    includes: ['30 ceiling latex balloons','10 heart balloons','20 floor balloons','Small fresh rose-petal trail','12 LED candles','Ribbon/ties on 2 pillows','Balloon numbers OR simple “Happy Birthday” balloon banner','Basic room styling']
  },
  {
    title: 'Luxury Room Experience',
    price: 500,
    image: 'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-balloon-room-2.jpg?v=1789132971',
    variantId: '50182941311114',
    setup: '~2.5–3 hours',
    includes: ['40 ceiling latex balloons','15 heart balloons','25 floor balloons','Medium fresh rose-petal trail','24 LED candles','Ribbon styling on 2 pillows','1 custom balloon banner','Balloon numbers','Small floral arrangement/rose accent','Elevated room styling']
  },
  {
    title: 'The Princess Experience',
    price: 750,
    image: 'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-petal-bath.jpg?v=1789132980',
    variantId: '50182941540490',
    setup: '~3–3.5 hours',
    includes: ['50-count fresh rose bouquet','50 ceiling latex balloons','20 heart balloons','30 floor balloons','XL fresh rose-petal trail','36 LED candles','Custom balloon banner','Balloon numbers','Ribbon styling on pillows','Additional floral accents','Full luxury room styling']
  }
];

let shopDomain = '';
fetch('/api/shopify-status').then(r => r.json()).then(data => {
  shopDomain = data?.shop?.myshopifyDomain || '';
}).catch(() => {});

function addLuxuryRoomSection(){
  if(document.getElementById('luxury-room-decor')) return;
  const shop = document.getElementById('shop');
  if(!shop) return;
  const section = document.createElement('section');
  section.id = 'luxury-room-decor';
  section.className = 'luxury-room-section';
  section.innerHTML = `
    <div class="luxury-room-wrap">
      <div class="luxury-room-heading">
        <div class="eyebrow">Romantic luxury experiences</div>
        <h2>Luxury Room Decor</h2>
        <p>Transform a room into an unforgettable celebration with balloons, fresh rose petals, candles and floral details.</p>
      </div>
      <div class="luxury-room-grid">
        ${luxuryPackages.map(pkg => `
          <article class="luxury-room-card">
            <img src="${pkg.image}" alt="${pkg.title}">
            <div class="luxury-room-copy">
              <h3>${pkg.title}</h3>
              <p class="luxury-room-price">Starting at $${pkg.price}</p>
              <ul>${pkg.includes.map(item => `<li>${item}</li>`).join('')}</ul>
              <div class="luxury-room-setup"><strong>Estimated setup:</strong> ${pkg.setup}</div>
              <button class="luxury-room-button" data-variant="${pkg.variantId}">REQUEST THIS PACKAGE</button>
            </div>
          </article>`).join('')}
      </div>
    </div>`;
  shop.parentNode.insertBefore(section, shop.nextSibling);
  section.querySelectorAll('.luxury-room-button').forEach(button => {
    button.addEventListener('click', () => {
      const variantId = button.dataset.variant;
      if(shopDomain) window.location.href = `https://${shopDomain}/cart/${variantId}:1`;
      else document.getElementById('contact')?.scrollIntoView({behavior:'smooth'});
    });
  });
}

const luxuryObserver = new MutationObserver(addLuxuryRoomSection);
luxuryObserver.observe(document.documentElement,{childList:true,subtree:true});
addLuxuryRoomSection();
