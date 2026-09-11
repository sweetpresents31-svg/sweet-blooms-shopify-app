const categories = [
  { name: "Birthday", image: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=900&q=85" },
  { name: "Love & Romance", image: "https://images.unsplash.com/photo-1518709779341-56cf4535e94b?auto=format&fit=crop&w=900&q=85" },
  { name: "Celebrations", image: "https://images.unsplash.com/photo-1487412912498-0447578fcca8?auto=format&fit=crop&w=900&q=85" },
  { name: "Just Because", image: "https://images.unsplash.com/photo-1455582916367-25f75bfc6710?auto=format&fit=crop&w=900&q=85" }
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
      <span>Find the perfect flowers for every celebration and meaningful moment.</span>
    </div>
    <div class="original-occasion-grid">
      ${categories.map((category) => `
        <a class="original-occasion-card" href="#shop" aria-label="Shop ${category.name}">
          <img src="${category.image}" alt="${category.name} flowers" />
          <div><h3>${category.name}</h3><span>Shop flowers →</span></div>
        </a>`).join('')}
    </div>`;
  shop.parentNode.insertBefore(section, shop);

  section.querySelectorAll('.original-occasion-card').forEach((card) => {
    card.addEventListener('click', () => setTimeout(() => document.getElementById('shop')?.scrollIntoView({behavior:'smooth'}), 10));
  });
}

const observer = new MutationObserver(addOriginalCategories);
observer.observe(document.documentElement, { childList: true, subtree: true });
addOriginalCategories();
