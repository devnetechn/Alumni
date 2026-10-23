const { curatedRouter } = require('../lib/curatedResource');

module.exports = curatedRouter({
  table: 'projects',
  listKey: 'projects',
  itemKey: 'project',
  selectSql: 'SELECT t.*, b.name AS batch_name FROM projects t LEFT JOIN batches b ON b.id = t.batch_id',
  fields: ['title', 'summary', 'description', 'image', 'batch_id', 'lead_name', 'featured'],
  required: 'title',
  intFields: ['batch_id'],
});
