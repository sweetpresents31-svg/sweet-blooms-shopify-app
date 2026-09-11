const luxuryCarouselItems = [
  {name:'The Essential Luxury Room Package',price:350,image:'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-balloon-room-1.jpg?v=1789132960',target:'luxury-room-decor'},
  {name:'Luxury Room Experience',price:500,image:'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-balloon-room-2.jpg?v=1789132971',target:'luxury-room-decor'},
  {name:'The Princess Experience',price:750,image:'https://cdn.shopify.com/s/files/1/0796/7172/2122/files/luxury-room-decor-rose-petal-bath.jpg?v=1789132980',target:'luxury-room-decor'}
];

let carouselStarted = false;

async function loadCarouselItems(){
  try{
    const response = await fetch('/api/flowers');
    const data = await response.json();
    const flowerItems = Array.isArray(data) ? data.map(item => ({
      name:item.name,
      price:Number(item.price || 0),
      image:item.image || '',
      target:'shop'
    })) : [];
    return [...flowerItems, ...luxuryCarouselItems];
  }catch{
    return [...luxuryCarouselItems];
  }
}

function visibleCards(){
  if(window.innerWidth <= 460) return 1;
  if(window.innerWidth <= 720) return 2;
  if(window.innerWidth <= 980) return 3;
  return 4;
}

async function addHomeCarousel(){
  if(carouselStarted || document.querySelector('.home-product-carousel')) return;
  const categories = document.querySelector('.original-occasion-section');
  if(!categories) return;
  carouselStarted = true;
  const items = await loadCarouselItems();
  if(!items.length) return;

  const section = document.createElement('section');
  section.className = 'home-product-carousel';
  section.innerHTML = `
    <div class="carousel-inner">
      <div class="carousel-heading">
        <p>Discover Sweet Blooms</p>
        <h2>Shop Our Current Favorites</h2>
      </div>
      <div class="product-rotator">
        <div class="product-rotator-track">
          ${items.map(item => `
            <a class="product-rotator-card" href="#${item.target}" data-target="${item.target}">
              ${item.image ? `<img src="${item.image}" alt="${item.name}">` : `<div class="product-rotator-placeholder">💐</div>`}
              <div class="product-rotator-copy">
                <small>${item.target === 'luxury-room-decor' ? 'Luxury Room Decor' : 'Sweet Blooms'}</small>
                <h3>${item.name}</h3>
                <strong>From $${Number(item.price).toFixed(2)}</strong>
              </div>
            </a>`).join('')}
        </div>
      </div>
      <div class="product-rotator-controls">
        <button class="product-rotator-prev" aria-label="Previous products">‹</button>
        <button class="product-rotator-next" aria-label="Next products">›</button>
      </div>
      <div class="product-rotator-dots"></div>
    </div>`;
  categories.parentNode.insertBefore(section, categories);

  const track = section.querySelector('.product-rotator-track');
  const cards = [...section.querySelectorAll('.product-rotator-card')];
  const dotsWrap = section.querySelector('.product-rotator-dots');
  let index = 0;
  let timer;

  function maxIndex(){ return Math.max(0, cards.length - visibleCards()); }
  function cardStep(){
    if(cards.length < 2) return 0;
    const gap = parseFloat(getComputedStyle(track).gap || '0');
    return cards[0].getBoundingClientRect().width + gap;
  }
  function renderDots(){
    const pages = maxIndex() + 1;
    dotsWrap.innerHTML = Array.from({length:pages},(_,i)=>`<button class="product-rotator-dot ${i===index?'active':''}" data-index="${i}" aria-label="Show product set ${i+1}"></button>`).join('');
    dotsWrap.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>{ index=Number(btn.dataset.index); update(); restart(); }));
  }
  function update(){
    index = Math.max(0, Math.min(index, maxIndex()));
    track.style.transform = `translateX(-${index * cardStep()}px)`;
    [...dotsWrap.children].forEach((dot,i)=>dot.classList.toggle('active',i===index));
  }
  function next(){ index = index >= maxIndex() ? 0 : index + 1; update(); }
  function prev(){ index = index <= 0 ? maxIndex() : index - 1; update(); }
  function restart(){ clearInterval(timer); timer = setInterval(next, 3800); }

  section.querySelector('.product-rotator-next').addEventListener('click',()=>{next();restart();});
  section.querySelector('.product-rotator-prev').addEventListener('click',()=>{prev();restart();});
  cards.forEach(card=>card.addEventListener('click',(event)=>{
    event.preventDefault();
    document.getElementById(card.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});
  }));
  window.addEventListener('resize',()=>{renderDots();update();});
  renderDots();
  update();
  restart();
}

const carouselObserver = new MutationObserver(addHomeCarousel);
carouselObserver.observe(document.documentElement,{childList:true,subtree:true});
addHomeCarousel();
