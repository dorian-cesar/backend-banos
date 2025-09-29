const { DateTime } = require('luxon');

function nowCL() {
    const dt = DateTime.now().setZone('America/Santiago');
    return {
        fecha: dt.toISODate(),
        hora: dt.toFormat('HH:mm:ss'),
    };
}

module.exports = { nowCL };
