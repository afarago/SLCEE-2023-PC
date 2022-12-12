//=== Helper functions for render STATUS segments ===================================================================
function renderMatchState(matchdto) {
  const $matchcontainer = $('#matchstate');
  try {
    $('.tooltipped', $('#matchstate')).tooltip('destroy');
  } catch {}
  const content = `
      ${renderCreationParams(matchdto)}
      ${renderPlayer(matchdto, 0)}
      <div class="col m6 s12 no-padding playtable">
        ${renderPlayArea(matchdto)}
        ${renderDrawPile(matchdto)}
        ${renderDiscardPile(matchdto)}
      </div>
      ${renderPlayer(matchdto, 1)}
    `;
  $matchcontainer.html($(content));

  //-- add eventhandlers in case of active player and authed user to react to effect
  if (isAuthUserIsThisPlayer(matchdto.activePlayerIndex)) {
    const effectType = matchdto.state?.pendingEffect?.effectType;
    function getRespondToEffectSelector(effectType) {
      switch (effectType) {
        case 'Map':
          return $('.pendingeffect .playcards');
        case 'Oracle':
          //-- add "flip back" as an extra card
          $('.pendingeffect .playcards').after(
            `<span class='playcards' data-card='null'><span class='cardvalue'>flip&nbsp;back</span></span>`
          );
          return $('.pendingeffect .playcards');
        case 'Cannon':
          return $(`.bank:not(.player${matchdto.state.currentPlayerIndex}) .playcards`);
        case 'Sword':
          const myBankSuitsFilter = Object.keys(matchdto.state.banks[matchdto.state.currentPlayerIndex])
            .map((s) => `[data-suit!='${s}']`)
            .join('');
          return $(`.bank:not(.player${matchdto.state.currentPlayerIndex}) .playcards${myBankSuitsFilter}`);
        case 'Hook':
          return $(`.bank.player${matchdto.state.currentPlayerIndex} .playcards`);
      }
    }
    const $selector = getRespondToEffectSelector(effectType);
    if ($selector) {
      $selector.addClass('pulse').on('click', function (el) {
        const card = $(el.currentTarget).data('card');
        const useraction = { etype: 'ResponseToEffect', effect: { effectType, card } };
        executeUserAction(useraction);
      });
    }
  }

  // return main container
  return $matchcontainer;
}
function renderCreationParams(matchdto) {
  if (
    matchdto.creationParams &&
    Object.getOwnPropertyNames(matchdto.creationParams).filter((n) => !['playerids', 'randomSeed'].includes(n))
      ?.length > 0
  ) {
    return `
      <div class='statusbox col s12 grey lighten-5'>
        <h6 class='grey lighten-1'>CreationParams</h6>
        <div>
          ${matchdto.creationParams ? renderObject(matchdto.creationParams) : '(not authorized to view details.)'}
        </div>
      </div>`;
  } else {
    return '';
  }
}
function renderPlayArea(matchdto) {
  const plarea_color = isFinished(matchdto)
    ? 'white grey-text'
    : !matchdto.activePlayerIndex
    ? 'light-green white-text'
    : 'orange white-text';
  return `
      <div class="playarea statusbox col s12 ${plarea_color}" >
        <h6 class="${plarea_color} darken-2">Playarea</h6>
        <div>
          ${renderCards(matchdto.state.playArea) || '(no cards on the table)'}
          ${
            matchdto.state.pendingEffect
              ? `<span class="pendingeffect" data-effecttype="${matchdto.state.pendingEffect.effectType}">(` +
                renderObject(matchdto.state.pendingEffect) +
                ')</span>'
              : ''
          }
        </div>
      </div>`;
}
function renderDrawPile(matchdto) {
  drawpile_color = isFinished(matchdto) ? 'white grey-text' : 'grey';
  return `
      <h6 class="drawpile statusbox col ${drawpile_color} lighten-4">Draw · 
        <span class='playcards back cardvalue'>${matchdto.drawPileSize}</span>
      </h6>
      `;
}
function renderDiscardPile(matchdto) {
  return `
      <h6 class="discardpile statusbox col grey darken-1 white-text">Discard · 
        <span class='playcards back cardvalue'>${matchdto.discardPileSize}</span>
      </h6>
      `;
}
function renderPlayer(matchdto, idx) {
  const bank = matchdto.state?.banks[idx];
  const playerid = matchdto.playerids?.[idx];
  const playername = matchdto.playernames?.[idx];
  const pcolor = `${!idx ? 'light-green' : 'orange'}`;
  const bankinfo = getBankValueAndSize(bank);
  return `<div class="player${idx} bank statusbox col m3 s12 ${pcolor} white-text">
      <h6 class="${pcolor} darken-2">
      <span class="tooltipped 
        ${idx === matchdto.activePlayerIndex ? 'activePlayer' : ''} 
        ${matchdto.state?.winnerIdx === idx ? 'winningPlayer' : ''}"
        data-tooltip="#${playerid} · ${playername}">${playername}</span> · €${bankinfo.value}💶
      </h6>
      <div>${renderBank(bank)}</div>
      <div class="actions ${idx == matchdto.activePlayerIndex && isAuthUserIsThisPlayer(idx) ? '' : 'hide'}">
        <a class="btn useraction waves-effect" 
          data-useraction='${JSON.stringify({ etype: 'Draw' })}'>Draw</a>
        <a class="btn useraction waves-effect ${!matchdto.state?.playArea?.length ? 'disabled' : ''}"
          data-useraction='${JSON.stringify({ etype: 'EndTurn' })}'>End Turn</a>
      </div>
    </div>`;
}
function isAuthUserIsThisPlayer(idx) {
  return !!authenticated_username && matchdto?.playerids?.[idx] === authenticated_username;
}
//=== Helper functions for render MOVE segments ===================================================================
function renderMovesTableAppend(moves, doanimate = true) {
  const $movescontainer = $('#moveslist');
  const $content = $(moves?.map(renderMove).join(''));
  if (doanimate) $content.hide().show('slow');

  //-- update sequence header (last hove is first one due to descending order)
  const lastmove = moves.at(0);
  $('#sequenceId').html(`&nbsp;at turn ${lastmove.turnId}, move ${lastmove.sequenceInTurnId}`);

  $content.prependTo($movescontainer);
  return $content;
}
function renderMove(move) {
  const event = move.events.at(0);
  const pidx = event.playerIndex;
  const { etype, ...useraction_rest } = move.userAction || {};
  const placedcards = move.events
    .flatMap(
      (e) =>
        e.cardPlacedToPlayAreaCard ??
        e.drawCard ??
        e.turnEndedDelta?.banks?.[e.playerIndex]?.added ??
        e.turnEndedBonusCards
    )
    .filter(
      (card1, index, self) =>
        card1 &&
        //-- is unique (finds only first occurence)
        self.findIndex((card2) => card2 && card1.suit === card2.suit && card1.value === card2.value) === index
    )
    .map((c) => renderCard(c))
    .join('');
  return `
      <tbody class="movebody" id="move_${event.sequenceId}" 
          data-turnid="${move.turnId}" 
          data-sequenceinturnid="${move.sequenceInTurnId}">
        <tr class="moveheader player${pidx}">
          <td class="bar">&nbsp;</td>
          <td>${move.turnId ?? ''}.${move.sequenceInTurnId ?? ''}</td>
          <td>
            <span class="eventType ${!$.isEmptyObject(useraction_rest) ? 'tooltipped' : ''}" 
              data-tooltip='${JSON.stringify(useraction_rest)}' data-position='top'>
              ${move.userAction?.etype ?? event?.eventType}
            </span>
          </td>
          <td>
            ${placedcards}
            <div class="datepill hide-on-med-and-down">&nbsp;at ${new Date(move.at)?.toLocaleString()}${
    move.clientIP ? ' from ' + move.clientIP : ''
  } </div>
          </td>
          <td class="bar">&nbsp;</td>
        </tr>
        ${move.events.map(renderEventRow).join('')}
      </tbody>
      `;
}
function renderEventRow(event) {
  const { eventType, playerIndex: pidx, ...event_rest } = event || {};

  return `
      <tr class="moveevent player${pidx}">
        <td class="bar">&nbsp;</td>
        <td></td>
        <td class="eventType">${event.eventType}</td>
        <td class="eventDetails">${renderObjectIfNotEmpty(event_rest)}</td>
        <td class="bar">&nbsp;</td>
      </tr>
      `;
}

//=== Helper functions for animations =================================================================================
const delayFn = (ms) => new Promise((_) => setTimeout(_, ms));
function animateMoveEventEffect(move, nextFn) {
  //-- 0. remove pending effect
  const fnRemoveEffects = (resolve, reject) => {
    if (!matchdto.pendingEffect)
      return $('.playarea .pendingeffect')
        .removeClass('pulse') //-- remove any highlights
        .animate({ opacity: 0 }, 'fast')
        .promise()
        .then(($el) => $el.remove());
  };

  //-- 1. animations for playarea changes
  const fnPlayAreaAnimations = (resolve, reject) => {
    //-- collect cards placed on play area
    const cards_pa = move.events
      .flatMap(
        (e) =>
          e.drawCard ?? //-- show even if not placed due to bust
          e.cardPlacedToPlayAreaCard ?? //-- mainly effects except for cannon
          (e.responseToEffectType !== 'Cannon' ? e.responseToEffectCard : null) //-- mainly effects except for cannon
      )
      .filter(
        //-- is unique (finds only first occurence)
        (card1, index, self) =>
          card1 &&
          self.findIndex((card2) => card2 && card1.suit === card2.suit && card1.value === card2.value) === index
      );

    if (cards_pa.length) {
      //-- render all cards and add them to the revealer object
      const cardsContent = cards_pa.map((card, idx) =>
        $(renderCard(card)).addClass('bigcard animate_initial_to_playarea')
      );
      $('<div>').html(cardsContent).addClass('move-effect-revealer').appendTo('.playarea h6');

      //-- animate draw effect one-by-one on all cards
      return cardsContent
        .map(function ($e) {
          return function () {
            return $e.animate({ opacity: 1, top: 0 }, 'fast').promise();
          };
        })
        .reduce(function (cur, next) {
          return cur.then(next);
        }, $().promise())
        .then(() => delayFn(500))
        .then(() => $('.bigcard').animate({ opacity: 0, display: 'none' }, 300).promise())
        .then(() => $('.move-effect-revealer').remove())
        .then(resolve);
    }
  };

  //-- 2. animations for bank removals
  const fnGetBankRemovalAnimations = (resolve, reject) => {
    const events_cardremoved_bank = move.events.filter((e) => e.eventType === 'CardRemovedFromBank');
    if (events_cardremoved_bank.length) {
      const event = events_cardremoved_bank[0];
      const pidx = event.cardRemovedFromBankIndex;
      const card = event.cardRemovedFromBankCard;
      const selector =
        `.player${pidx}.bank .playcards[data-suit='${card.suit}']` +
        (matchdto?.state?.banks?.[pidx]?.[card.suit]?.length === 1 ? '' : ' span:first-child');
      return $(selector)
        .toggleClass('animated_disappear')
        .promise()
        .then(() => delayFn(750)) //-- workaround, simplification to avoid CSS onanimateend callback promise transformation
        .then(resolve);
    }
  };

  //-- 3. bust
  const fnBustedAnimations = (resolve, reject) => {
    const evTurnEnded = move.events.find((e) => e.eventType === 'TurnEnded');
    if (evTurnEnded && !evTurnEnded.turnEndedIsSuccessful) {
      const $bustedCard = $("<span class='playcards bustercard cardvalue'>BUSTED</span>");
      return $bustedCard
        .css({ opacity: 0 })
        .appendTo('.playarea div')
        .animate({ opacity: 1 }, 'fast')
        .promise()
        .then(() => delayFn(750))
        .then(() => $bustedCard.remove())
        .then(resolve);
    }
  };

  //-- 4: add bonus cards (if any)
  const fnTurnEndedBonusAnimations = (resolve, reject) => {
    const cards = move.events.find((e) => e.eventType === 'TurnEnded')?.turnEndedBonusCards;
    if (!!cards?.length) {
      const basepromise = $('.playarea .pendingeffect')
        .removeClass('pulse') //-- remove any highlights
        .animate({ opacity: 0 }, 'fast')
        .promise()
        .then(($el) => $el.remove());

      return cards
        .map((e) => {
          return function () {
            return $(renderCard(e))
              .appendTo($('.playarea div'))
              .css('opacity', 0)
              .animate({ opacity: 1 }, 'fast')
              .promise();
          };
        })
        .reduce(function (cur, next) {
          return cur.then(next);
        }, basepromise)
        .then(resolve);
    }
  };

  //-- 5. animations for collect in TurnEnded
  const fnTurnEndedCollectAnimations = (resolve, reject) => {
    const evTurnEnded = move.events.find((e) => e.eventType === 'TurnEnded');

    if (evTurnEnded) {
      const playarea_cards = $('.playarea .playcards').get();
      //-- const collectedCards = evTurnEnded?.turnEndedDelta.banks.at(evTurnEnded?.playerIndex)?.added; // will not show cards acquired from own bank
      let collectedCards;
      const turnEndedIsSuccessful = evTurnEnded.turnEndedIsSuccessful;
      if (!turnEndedIsSuccessful) {
        const anchorIdx = playarea_cards.findIndex((elem) => $(elem).data('card')?.suit == 'Anchor');
        collectedCards = anchorIdx >= 0 ? playarea_cards.slice(0, anchorIdx) : [];
      } else {
        collectedCards = playarea_cards;
      }

      if (collectedCards?.length) {
        //-- animate draw effect one-by-one on all cards
        $('.playarea .playcards').removeClass('pulse');
        console.log(collectedCards);
        return $(collectedCards)
          .css({ position: 'relative', 'z-index': 2 })
          .get()
          .reduce((cur, elem) => {
            return cur.then(() => {
              return $(elem).animate({ top: -50 }, 'fast').promise();
              //next();
            });
          }, $().promise())
          .then(() => delayFn(500))
          .then(resolve);
      }
    }
  };

  //-- finally: execute the actual animations
  Promise.resolve()
    .then(fnRemoveEffects)
    .then(fnGetBankRemovalAnimations)
    .then(fnPlayAreaAnimations)
    .then(fnBustedAnimations)
    .then(fnTurnEndedBonusAnimations)
    .then(fnTurnEndedCollectAnimations)
    .then(nextFn);
}

//=== Helper functions for render =================================================================================
function renderObjectIfNotEmpty(value) {
  return value !== undefined && value !== null && Object.keys(value)?.length > 0 ? renderObject(value) : null;
}
function renderObject(value) {
  return renderObjectIterator(null, value);
}
function renderObjectIterator(key, value) {
  if (value === null || value === undefined) {
    return '';
  } else if (value['suit'] && value['value']) {
    const retval = renderCard(value);
    return retval;
  } else if (key === 'effectType' || key === 'responseToEffectType') {
    const retval = renderSuit(value, true);
    return retval;
  } else if (key === 'matchEndedWinnerIdx') {
    const pidx = value;
    return `<span class='player${pidx}'>${matchdto.playernames[pidx]} (${matchdto.playerids[pidx]})</span>`;
  } else if (Array.isArray(value)) {
    const retval =
      '[' +
      [...value.entries()]
        //.filter(([key, value]) => value!==undefined)
        .map(([key, value]) => renderObjectIterator(key, value))
        .join(' ') +
      ']';
    return retval;
  } else if (typeof value === 'object') {
    //-- Implements recursive object serialization according to JSON spec but without quotes around the keys.
    const retval = Object.keys(value)
      //.filter((key) => value[key]!==undefined)
      .map((key) => `${key}: ${renderObjectIterator(key, value[key])}`)
      .join(' · ');
    return retval || '{}';
  } else {
    return value;
  }
}
function renderSuit(suit, doAddTitle) {
  return `<img src='/img/suit_${suit?.toLowerCase()}.png' 
      class='cardsuit ${doAddTitle ? 'tooltipped' : ''}'
      ${doAddTitle ? 'data-tooltip="' + suit + '"' : ''} 
      alt="${suit}"/>`;
}
function renderCards(cards) {
  const dlist = cards?.map((card, idx) => renderCard(card))?.join(' ');
  return dlist;
}
function renderCard(card) {
  if (!card) return null;
  return `<span class="playcards tooltipped" 
      data-tooltip="${card.suit} ${card.value}" 
      data-card='${JSON.stringify(card)}'>
        ${renderSuit(card.suit)}${renderCardValues(card.value)}
      </span>`;
}
function renderBank(bank) {
  const retval = Object.entries(bank)
    ?.sort()
    ?.map(([cpacksuit, cpack]) => {
      const cardvalues = cpack?.sort().reverse();
      const cardvalues_str = cardvalues.map((item) => `<span>${item}</span>`).join('');
      return (
        `<span class="playcards tooltipped" 
              data-tooltip="${cpacksuit} ${cardvalues.join(', ')}"
              data-suit='${cpacksuit}'
              data-card='${JSON.stringify({ suit: cpacksuit, value: cardvalues.at(0) })}'>` +
        `${renderSuit(cpacksuit)}${renderCardValues(cardvalues_str)}</span>`
      );
    })
    .join(' ');
  return retval || '(no cards in the bank)';
}
function renderCardValues(value) {
  return `<span class="cardvalue">${value}</span>`;
}

//=== Helper functions misc =================================================================================
function isFinished(matchdto) {
  return matchdto.activePlayerIndex === null;
}
function getBankValueAndSize(bank) {
  return Object.entries(bank).reduce(
    (acc, [_suit, stack]) => ({ size: acc.size + stack.length, value: acc.value + Math.max.apply(null, stack) }),
    { size: 0, value: 0 }
  );
}
$(() => {
  $('#matchstate').on('click', 'a.btn.useraction', function () {
    const useraction = $(this).data('useraction');
    executeUserAction(useraction);
  });
});
function executeUserAction(data) {
  $.post({
    url: `/api/matches/${matchdto._id}`,
    data: JSON.stringify(data),
    contentType: 'application/json',
    dataType: 'json',
    //success: PlainObject data, String textStatus, jqXHR jqXHR )
    //!! todo on failue  M.toast({html: 'I am a toast!'})
  }).fail(function (data) {
    M.toast({ html: data.responseJSON?.error });
  });
}

//=== CSR render ===================================================================================
function renderMatchCSR(matchdto) {
  renderMatchState(matchdto);
  renderMovesTableAppend(matchdto.moves.reverse(), false);
}

$(() => {
  //-- initial render of match based on SSR start data
  renderMatchCSR(matchdto);
});

//=== Socket.IO ===================================================================================
const debug_switch = { log_socketio: false };
$(() => {
  const socket = io();
  socket.onAny((event, ...args) => {
    // if (debug_switch?.log_socketio) 
    console.log('socketio', event, args);
  });

  //-- join room, so that this browser receives only day specific updates
  socket.emit('room', socket_room);

  //-- register socket.io listeners on client side
  socket.on('match:update:details', updateMatchCSR);
  socket.on('move:insert:details', updateMatchInsertMoveCSR);
});

let isMoveRendering = false;
let matchRenderingFn = null;
function updateMatchCSR(payload) {
  let newvalue = typeof payload === 'object' ? payload : JSON.parse(payload);
  const oldvalue = matchdto;
  if (!!oldvalue) delete newvalue.moves; //-- make sure no moves are coming in
  matchdto = { ...oldvalue, ...newvalue };

  //-- guard match rendering, do not update match until move related animation is completed
  //-- theoreticall match update follows the move update, so could do everything here - no delivery order guarantee yet
  matchRenderingFn = function () {
    const $content = renderMatchState(matchdto);
    $('.tooltipped', $content).tooltip();
  };
  if (!isMoveRendering) {
    //-- if no move rendering is in place, just render the update, otherwise the updateMatchInsertMoveCSR will trigger matchRenderingFn as a callback
    matchRenderingFn();
    matchRenderingFn = null;
  }
}

function updateMatchInsertMoveCSR(payload) {
  const movedto = typeof payload === 'object' ? payload : JSON.parse(payload);
  matchdto.moves = [movedto, ...matchdto.moves];
  const $content = renderMovesTableAppend([movedto], true);
  $('.tooltipped', $content).tooltip();

  isMoveRendering = true;
  //-- guard match rendering, see comment above
  animateMoveEventEffect(movedto, () => {
    isMoveRendering = false;
    if (matchRenderingFn) {
      matchRenderingFn();
      matchRenderingFn = null;
    }
  });

  //TODO; add for loop with reverse+break on matchended/turnended
  movedto.events.forEach((ev) => {
    if (ev.eventType === 'TurnEnded') {
      if (matchdto.playerids.indexOf(authenticated_username) < 0) {
        M.toast({ html: `The turn of ${matchdto.playernames[matchdto.state?.currentPlayerIndex]} has ended. ` });
        //-- NOTE:moves is updated first, the ony the Match - activePlayerIndex will not be ok here prob / nor reliable
      } else {
        if (isAuthUserIsThisPlayer(matchdto.state?.currentPlayerIndex)) {
          if (!ev.turnEndedIsSuccessful) M.toast({ html: 'Your turn is busted, moving to next player.' });
        } else {
          M.toast({ html: `It's your turn, ${matchdto.playernames[matchdto.activePlayerIndex]}!` });
        }
      }
    } else if (ev.eventType === 'MatchEnded') {
      //-- broadcast to everyone
      M.toast({ html: 'Match ended!' });
    }
  });
}
