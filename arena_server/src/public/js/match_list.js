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
    //-- modified
    matchdata = { ...matchesData[storedIdx], ...matchdata };
    matchesData[storedIdx] = matchdata;
    const $content = $(renderMatchRowCSR(matchdata));

    //-- find and replace row html
    const $row = $(`tr[data-matchid='${matchdata.id}'`, $matchestable);
    $row.replaceWith($content); //todo: improve later, no need to replace tr e.g.

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
  if (!matchesData?.length) $('#matchestable tbody.nodata').removeClass('hide');

  if (!!authenticated_username) {
    $('#btnCreatePracticeMatch').toggleClass('hide', false);
    $('#btnCreatePracticeMatch').on('click', function () {
      $.post({
        url: `/api/matches`,
      });
    });
  }
});

//-- temp solution for page data rerender on back nav
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    //   setTimeout(() => {
    //   //-- on load from bfcache
    //   $.getJSON(`/api/matches`,(data) => {
    //     renderMatchesCSR(data);
    //   })
    // },2000)
    location.reload();
  }
});

//=== Socket.IO ===================================================================================
const debug_switch = { log_socketio: false };
$(() => {
  const socket = io();
  socket.onAny((event, ...args) => {
    if (debug_switch?.log_socketio) console.log('socketio', event, args);
  });

  //-- join room, so that this browser receives only day specific updates
  socket.emit('room', socket_room);

  //-- remember that this runs on client side
  socket.on('match:update:header', updateMatchCSR);
});
