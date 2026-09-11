const STORE_ADDRESS = '16211 Clay Rd Ste 108, Houston, TX 77084';

function applyStoreAddress() {
  document.querySelectorAll('.contact-cards article').forEach((card) => {
    const label = card.querySelector('strong')?.textContent?.trim().toLowerCase();
    if (label === 'location') {
      const p = card.querySelector('p');
      if (p && p.textContent !== STORE_ADDRESS) p.textContent = STORE_ADDRESS;
    }
  });
}

const locationObserver = new MutationObserver(applyStoreAddress);
locationObserver.observe(document.documentElement, { childList: true, subtree: true });
applyStoreAddress();
