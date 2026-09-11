const categories = [
  { name: "Birthday", image: "https://cdn.shopify.com/s/files/1/0796/7172/2122/collections/sweet-blooms-birthday.jpg?v=1789131300", target: "shop" },
  { name: "Love & Romance", image: "https://cdn.shopify.com/s/files/1/0796/7172/2122/collections/sweet-blooms-love-romance.jpg?v=1789131306", target: "shop" },
  { name: "Celebrations", image: "https://cdn.shopify.com/s/files/1/0796/7172/2122/collections/sweet-blooms-celebrations.jpg?v=1789131313", target: "shop" },
  { name: "Just Because", image: "https://cdn.shopify.com/s/files/1/0796/7172/2122/collections/sweet-blooms-just-because.jpg?v=1789131320", target: "shop" },
  { name: "Luxury Room Decor", image: "https://cdn.shopify.com/s/files/1/0796/7172/2122/collections/luxury-room-decor-rose-balloon-room-1.jpg?v=1789132987", target: "luxury-room-decor" }
];

function addOriginalCategories() {
  if (document.querySelector('.original-occasion-section')) return;
  const shop = document.getElementById('shop');
  if (!shop) return;

  const section = document.createElement('section');
  section.className = 'original-occasion-section section-pad';
  section.id = 'occasions';
  section.innerHTML = `
    <div class="original-occasion-heading">
      <p>Flowers for every moment</p>
      <h2>Shop by Occasion</h2>
      <span>Find the perfect flowers and luxury experiences for every celebration and meaningful moment.</span>
    </div>
    <div class="original-occasion-grid">
      ${categories.map((category) => `
        <a class="original-occasion-card" href="#${category.target}" data-target="${category.target}" aria-label="Shop ${category.name}">
          <img src="${category.image}" alt="${category.name}" />
          <div><h3>${category.name}</h3><span>Explore →</span></div>
        </a>`).join('')}
    </div>`;
  shop.parentNode.insertBefore(section, shop);

  section.querySelectorAll('.original-occasion-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = card.dataset.target || 'shop';
      setTimeout(() => document.getElementById(targetId)?.scrollIntoView({behavior:'smooth', block:'start'}), 10);
    });
  });
}

const observer = new MutationObserver(addOriginalCategories);
observer.observe(document.documentElement, { childList: true, subtree: true });
addOriginalCategories();
