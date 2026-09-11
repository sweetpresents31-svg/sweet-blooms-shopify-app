const SWEET_BLOOMS_LOGO = "https://cdn.shopify.com/s/files/1/0796/7172/2122/files/sweet-blooms-logo.png?v=1789131254";

function applySweetBloomsBranding() {
  const logoButton = document.querySelector('.logo-button');
  if (logoButton && !logoButton.querySelector('.official-logo-img')) {
    logoButton.innerHTML = `<img class="official-logo-img" src="${SWEET_BLOOMS_LOGO}" alt="Sweet Blooms Flower Shop" />`;
  }

  document.querySelectorAll('.product-placeholder').forEach((placeholder) => {
    placeholder.classList.add('floral-placeholder');
  });
}

const brandingObserver = new MutationObserver(applySweetBloomsBranding);
brandingObserver.observe(document.documentElement, { childList: true, subtree: true });
applySweetBloomsBranding();
