(function () {
  //=== List page rendering ===================================================================================
  function _displaySuit(suit, doAddTitle = true) {
    return `<img src='/img/suit_${suit?.toLowerCase()}.png' class='cardsuit ${doAddTitle ? 'tooltipped' : ''}' ${
      doAddTitle ? 'data-tooltip="' + suit + '"' : ''
    } alt="${suit}"/>`;
  }

  function renderMatchRowCSR(match) {
    let rowhtml;
    try {
      rowhtml =
        //--- tr
        `<tr data-matchid="${match.id}" class="matchrow ${match.finished ? 'finished' : 'running'}">` +
        //--- row head
        `<td>
            <a class="btn waves-effect waves-light ${
              match.finished ? 'grey' : 'light-blue darken-2'
            } tooltipped" href="/matches/${match.id}" data-tooltip="${match.id}" data-position="left">
              ${match.id.slice(-7)}
            </a>
          </td>` +
        //--- sequence
        `<td class="hide-on-small-only">${match.sequence}</td>` +
        //--- playarea
        `<td class="hide-on-med-and-down">
            ${match.table.playarea ? match.table.playarea + '🃏' : '-'}
            ${match.table.effect ? _displaySuit(match.table.effect) : ''}</td>` +
        //--- draw
        `<td class="hide-on-small-only">${match.table.drawpile ? match.table.drawpile + '🃏' : '-'}` +
        //--- discard
        `<td class="hide-on-med-and-down">${match.table.discardpile ? match.table.discardpile + '🃏' : '-'}` +
        //--- players
        match.playerdata
          .map(
            (currplayerdata, idx) =>
              `<td>
                <span class="player${idx} ${currplayerdata.active ? 'activePlayer' : ''} 
                  ${currplayerdata.winner ? 'winningPlayer' : ''}">
                  ${match.playernames[idx]}
                </span>
                · €<span>${currplayerdata.bankvalue}💶</span>
              </td>`
          )
          .join('') +
        //--- date
        `<td class="hide-on-large-and-down" colspan="${match.tags ? 1 : 2}">
            <span class="hide-on-med-and-down grey-text adjustedspan">
              ${new Date(match.startedat).toLocaleTimeString('hu')} - 
              <span>${new Date(match.lastmoveat).toLocaleTimeString('hu')}</span>
            </span>
          </td>` +
        //--- tags
        (Array.isArray(match.tags)
          ? `<td class="hide-on-large-and-down">` +
            match.tags?.map((tag) => `<div class='chip blue-grey lighten-5 grey-text right'>#${tag}</div>`).join('') +
            `</td>`
          : '');
    } catch (e) {
      rowhtml = `<tr><td colspan="100">[invalid match data: ${match?.id}, ${e.message}]</td></tr>`;
    }
    return rowhtml;
  }

  function updateMatchCSR(payload) {
    let matchdata = typeof payload === 'object' ? payload : JSON.parse(payload);
    const $matchestable = $('#matchestable tbody.data');

    //-- find and replace row data
    let storedIdx = matchesData.findIndex((value, index) => value.id === matchdata.id);
    if (storedIdx < 0) {
      //-- created, insert on top
      //-- do this only if full data received, otherwise it will display as an invalid data
      //TODO: might not be relevant to the current filter - rework adding new rows....
      if (matchdata.playerdata) {
        const $content = $(renderMatchRowCSR(matchdata));
        $content.hide().show('slow');

        $matchestable.prepend($content);
        matchesData.splice(0, 0, matchdata);
      }
    } else {
      //-- check if it updated compared to the stored one, if same - just return
      if (matchdata.lastmoveat === matchesData[storedIdx].lastmoveat) return;

      matchdata = { ...matchesData[storedIdx], ...matchdata };
      matchesData[storedIdx] = matchdata;
      const $content = $(renderMatchRowCSR(matchdata));

      //-- find and replace row html
      const $row = $(`tr[data-matchid='${matchdata.id}'`, $matchestable);
      $row.replaceWith($content);

      //flash the row
      const $btn = $('a.btn', $content);
      $btn
        .addClass('pulse')
        .stop()
        .delay(1000)
        .queue(function () {
          $(this).removeClass('pulse');
        });
    }
  }

  function renderMatchesCSR(matches) {
    const hasMore = matches.length > limit;
    if (hasMore) matches.pop();

    const $matchestable = $('#matchestable tbody.data');
    $matchestable.empty();
    matches.forEach((match) => {
      const htmlRow = renderMatchRowCSR(match);
      $matchestable.append(htmlRow);
    });

    if (hasMore)
      $matchestable.append(
        `<tr><td colspan=10 class='center-align'>More data available, not rendered due to performance reasons...</td></tr>`
      );
  }
  $(() => {
    //-- initial render of matches based on SSR start data
    renderMatchesCSR(matchesData);

    if (!!authenticated_username) {
      $('#btnCreatePracticeMatch').toggleClass('hide', false);
      $('#btnCreatePracticeMatch').on('click', function () {
        $.post({
          url: `/api/matches`,
        });
      });
    }
  });

  //-- temp solution for page data rerender on back nav - on load from bfcache
  window.addEventListener(
    'pageshow',
    (event) => {
      if (event.persisted) {
        setTimeout(() => {
          setFilterDate(filterDate, 'update');
        }, 0);
      }
    },
    { once: true }
  );

  function setFilterDate(datestr, loadData) {
    filterDate = datestr;

    const url = new URL(window.location.href);
    const params = new URLSearchParams(url.search);
    if (!params.has('at')) params.append('at', datestr);
    else params.set('at', datestr);
    url.search = '?' + params.toString();
    window.history.replaceState({}, undefined, url.toString());

    //-- todo set socket notification
    setNotificationRoom(datestr);

    //-- load data - if requested
    if (loadData) {
      $.getJSON(`/api/matches${window.location.search || '?'}&condensed=true`, (data) => {
        if (loadData === 'replace') {
          matchesData.splice(0, matchesData.length, ...data);
          renderMatchesCSR(matchesData);
        } else {
          data?.reverse().forEach(updateMatchCSR);
        }
      });
    }
  }

  //=== Socket.IO ===================================================================================
  let socket = null;
  $(() => {
    socket = io();
    socket.onAny((event, ...args) => {
      if (debug_switch?.log_socketio) console.log('socketio', event, args);
    });

    //-- remember that this runs on client side
    socket.on('match:update:header', updateMatchCSR);

    //-- join room, so that this browser receives only day specific updates
    if (filterDate) setNotificationRoom(filterDate);
  });

  setNotificationRoom = (datestr) => {
    if (socket) {
      const socket_room = `${authenticated_username ?? '*'}.date_${datestr}`;
      socket.emit('room', socket_room);
    }
  };

  //=== Header, DateTimePicker ===================================================================================
  let calendarStatStart = null;
  let calendarStatEvents = [];
  let dateTimePicker = null;

  function setNavDate(dateOrOffset) {
    newdate =
      dateOrOffset instanceof Date
        ? dateOrOffset
        : typeof dateOrOffset === 'number'
        ? new Date(new Date(filterDate).getTime() + dateOrOffset * 864e5)
        : new Date();
    setFilterDate(newdate.toJSON().split('T')[0], 'replace');
    dateTimePicker.setDate(newdate);
    dateTimePicker.setInputValue();
  }

  function retrieveBusyDays(date, cb) {
    $.getJSON(`/api/matches/busydays?at=${date.toDateString()}`, (data) => {
      const dataitems = data.map((item) => new Date(item).toDateString());
      cb(dataitems);
    });
  }

  $(() => {
    $('nav .section[data-section="list"]').addClass('shown');
    setFilterDate(filterDate, false);

    var $elem = document.querySelectorAll('.datepicker');
    calendarStatStart = new Date(filterDate);
    dateTimePicker = M.Datepicker.init($elem, {
      defaultDate: calendarStatStart,
      setDefaultDate: true,
      //maxDate: new Date(),
      showDaysInNextAndPreviousMonths: true,
      autoClose: true,
      events: calendarStatEvents,
      onClose: function () {
        setNavDate(this.date);
      },
      onDraw: function ($el) {
        const calendar = $el?.calendars?.[0];
        const date = new Date(calendar.year, calendar.month, 1);
        if (calendarStatStart.getTime() !== date.getTime()) {
          retrieveBusyDays(date, (dataitems) => {
            calendarStatStart = date;
            $el.options.events = dataitems;
            $el.draw(true);
          });
        }
      },
    })[0];

    $('#dateNavLeft').on('click', () => setNavDate(-1));
    $('#dateNavRight').on('click', () => setNavDate(+1));
  });
})();

const debug_switch = { log_socketio: false };
