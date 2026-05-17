'use strict';

function success(res, data, message = 'Operation successful.', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data });
}

function noData(res, message = 'Operation successful.', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message });
}

function error(res, message, statusCode = 500, extra = {}) {
  return res.status(statusCode).json({ success: false, message, ...extra });
}

module.exports = { success, noData, error };
