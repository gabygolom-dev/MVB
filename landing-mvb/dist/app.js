(() => {
  const form = document.querySelector('#project-form');
  const status = document.querySelector('#form-status');
  const contactStep = document.querySelector('#contact-step');
  const detailsStep = document.querySelector('#details-step');
  const stepLabel = document.querySelector('#form-step-label');
  const complete = document.querySelector('#form-complete');
  const whatsapp = document.querySelector('#whatsapp-link');

  function showFormStep(showDetails) {
    contactStep.hidden = contactStep.disabled = showDetails;
    detailsStep.hidden = detailsStep.disabled = !showDetails;
    complete.hidden = true;
    stepLabel.textContent = showDetails ? 'Etapa 2 de 2' : 'Etapa 1 de 2';
    status.textContent = '';
    const step = showDetails ? detailsStep : contactStep;
    step.querySelector('.form-step-title').focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!contactStep.hidden) {
      showFormStep(true);
      return;
    }
    const value = (name) => form.elements.namedItem(name).value.trim();
    const budget = form.elements.namedItem('orcamento').selectedOptions[0].textContent;
    const message = [
      'Olá, equipe MVB! Preenchi o formulário do site e quero conversar sobre meu projeto.',
      '',
      `Nome: ${value('nome')}`,
      `WhatsApp: ${value('whatsapp')}`,
      `Cidade: ${value('cidade')}`,
      `Ambientes: ${value('ambientes')}`,
      `Quando pretendo iniciar: ${value('prazo')}`,
      `Orçamento: ${budget}`,
    ].join('\n');
    whatsapp.href = `https://wa.me/5513988030103?text=${encodeURIComponent(message)}`;
    detailsStep.hidden = detailsStep.disabled = true;
    complete.hidden = false;
    status.textContent = '';
    document.querySelector('#complete-title').focus();
  });
  document.querySelector('#back-step').addEventListener('click', () => showFormStep(false));
  document.querySelector('#edit-project').addEventListener('click', () => showFormStep(true));
  document.querySelector('#continue-step').disabled = false;

  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const reveal = new IntersectionObserver((entries, observer) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        target.classList.replace('is-pending', 'is-revealed');
        observer.unobserve(target);
      }
    }, { rootMargin: '0px 0px -24px' });

    for (const card of document.querySelectorAll('.benefit')) {
      card.classList.add('is-pending');
      reveal.observe(card);
    }
  }

  const photos = [
    ['varanda-gourmet', 'Varanda gourmet', 'Varanda gourmet com armários claros, nicho iluminado e churrasqueira embutida', '58%'],
    ['cozinha-ripada', 'Cozinha com acabamento ripado', 'Cozinha com armários claros, detalhe ripado e iluminação sob os armários', '65%'],
    ['home-office', 'Home office', 'Escritório com armários azuis, nicho iluminado e bancada de madeira', '63%'],
    ['buffet-espelhado', 'Buffet na varanda', 'Buffet espelhado com adegas embutidas e vista para a cidade', '67%'],
    ['cozinha-amadeirada', 'Cozinha com armários amadeirados', 'Cozinha com armários inferiores amadeirados e iluminação sobre a bancada', '55%'],
    ['ambiente-6120', 'Cozinha integrada com ilha', 'Cozinha integrada com ilha clara, prateleira suspensa e armários em tom terroso', '59%'],
    ['ambiente-6078', 'Detalhes da cozinha integrada', 'Armários planejados em tons terrosos e claros ao redor da pia e do forno', '54%'],
    ['cozinha-azul-madeira', 'Cozinha em azul e madeira', 'Armários azuis com acabamento amadeirado e nichos abertos para louças', '50%'],
    ['escrivaninha-amadeirada', 'Escrivaninha planejada', 'Bancada de madeira com gavetas embutidas e cadeira de escritório', '79%'],
    ['cozinha-aberta-sala', 'Cozinha aberta para a sala', 'Cozinha com armários claros, prateleiras suspensas e bancada ripada atrás do sofá', '57%'],
    ['sala-painel-tv', 'Painel de TV na sala', 'Painel claro para TV e rack amadeirado com nichos e portas espelhadas', '56%'],
    ['escritorio-gaveteiro', 'Escritório com gaveteiro', 'Escritório com bancada escura em L e gavetas com puxadores metálicos', '69%'],
  ];
  const gallery = document.querySelector('.gallery');
  const image = document.querySelector('#gallery-photo');
  const index = document.querySelector('#gallery-index');
  const name = document.querySelector('#gallery-name');
  const pad = (number) => String(number).padStart(2, '0');
  let active = 0;

  function step(direction) {
    active = (active + direction + photos.length) % photos.length;
    const [file, title, description, position] = photos[active];
    image.src = `assets/${file}.webp`;
    image.alt = description;
    image.style.objectPosition = `50% ${position}`;
    index.textContent = `${pad(active + 1)} / ${pad(photos.length)}`;
    const count = document.createElement('span');
    count.className = 'sr-only';
    count.textContent = ` (foto ${active + 1} de ${photos.length})`;
    name.replaceChildren(title, count);
  }

  document.querySelector('#prev-photo').addEventListener('click', () => step(-1));
  document.querySelector('#next-photo').addEventListener('click', () => step(1));
  gallery.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    step(event.key === 'ArrowRight' ? 1 : -1);
  });
  gallery.querySelector('.gallery-arrows').hidden = false;
})();
