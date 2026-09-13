const PRODUCT_NAME = 'preston.ai';
const VERSION = '0.6.0';
const APPS = [
  { key:'dose', name:'Dose & Scale', url:'https://dose.preston.run' },
  { key:'parks', name:'State Parks', url:'https://parks.preston.run' },
  { key:'archive', name:'Archive', url:'https://archive.preston.run' }
];
const ADMIN = [
  {name:'preston.ai',domain:'preston.run',site:'https://preston.run',repo:'https://github.com/ppodolske/preston-run',railway:'https://railway.com/project/52e3a022-86d8-4191-bf3b-e4250d484055'},
  {name:'Dose & Scale',domain:'dose.preston.run',site:'https://dose.preston.run',repo:'https://github.com/ppodolske/dose-and-scale',railway:'https://railway.com/project/8981e7da-5867-484f-b951-39c4a1a60033'},
  {name:'MN & WI State Parks',domain:'parks.preston.run',site:'https://parks.preston.run',repo:'https://github.com/ppodolske/mnwistateparks',railway:'https://railway.com/project/9dfb8103-1ab5-43c1-a90e-5fb5c274889e'},
  {name:'Archive',domain:'archive.preston.run',site:'https://archive.preston.run',repo:'https://github.com/ppodolske/archive',railway:'https://railway.com/project/2bc0b4e2-ca87-4b74-94ff-828b9160444a'}
];
module.exports = { PRODUCT_NAME, VERSION, APPS, ADMIN };
