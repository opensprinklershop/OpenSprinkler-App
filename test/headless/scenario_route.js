return JSON.stringify({ href: location.href, page: $(".ui-page-active").attr("id"), fwm: OSApp.currentSession.controller.options.fwm });
