const isFlashType = (type) => typeof type === 'string'
  && /^[a-z][a-z0-9_-]{0,31}$/.test(type)
  && !['constructor', 'prototype', '__proto__'].includes(type);

const flash = (req, res, next) => {
  req.flash = (...args) => {
    const [type, message] = args;
    if (args.length > 2 || (args.length > 0 && !isFlashType(type))) {
      throw new TypeError('Use a valid flash message type.');
    }
    if (args.length === 2) {
      if (typeof message !== 'string') throw new TypeError('Flash messages must be strings.');
      req.session.flash ||= {};
      if (!Object.hasOwn(req.session.flash, type)) req.session.flash[type] = [];
      req.session.flash[type].push(message);
      return;
    }
    if (args.length === 1) {
      const messages = req.session.flash && Object.hasOwn(req.session.flash, type) ? req.session.flash[type] : [];
      if (req.session.flash && Object.hasOwn(req.session.flash, type)) {
        delete req.session.flash[type];
        if (Object.keys(req.session.flash).length === 0) delete req.session.flash;
      }
      return messages;
    }
    const messages = req.session.flash || {};
    if (req.session.flash) delete req.session.flash;
    return messages;
  };
  res.locals.flash = req.flash;
  next();
};

export default flash;
