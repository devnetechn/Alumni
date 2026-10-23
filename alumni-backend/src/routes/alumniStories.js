const { curatedRouter } = require('../lib/curatedResource');

module.exports = curatedRouter({
  table: 'alumni_stories',
  listKey: 'stories',
  itemKey: 'story',
  selectSql: 'SELECT t.* FROM alumni_stories t',
  fields: ['name', 'batch_label', 'role_title', 'photo', 'quote', 'story', 'featured'],
  required: 'name',
});
