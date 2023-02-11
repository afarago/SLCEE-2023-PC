// $(() => {
//   // window.onfocus = () => console.log('focus');
//   // window.onblur = () => console.log('blur');
// });

function renderFlag(country) {
  return country ? `<img class='iconflag' src='/img/flag_${country.toLowerCase()}.png'>` : '';
}

function updateConnectionStatus(isConnected, error) {
  $('#socketio_status')
    .attr('title', isConnected ? 'live updates' : `disconnected from live updates: ${error}`)
    .html(isConnected ? 'cloud_done' : 'cloud_off');
}
