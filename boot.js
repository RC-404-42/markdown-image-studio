(() => {
  const notice = document.querySelector('#bootNotice');
  const showFailure = () => {
    if (document.documentElement.dataset.appReady === 'true') return;
    notice.hidden = false;
  };

  window.addEventListener('error', showFailure, true);
  window.setTimeout(showFailure, 1800);
})();

