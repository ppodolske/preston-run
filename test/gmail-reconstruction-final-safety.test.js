'use strict';
const assert=require('node:assert/strict');
const {isReconstructableBookingCandidate}=require('../src/services/gmail-trip-reconstruction');

assert.equal(isReconstructableBookingCandidate({provider:'Jetstar',booking_type:'flight',confirmation_reference:null,starts_at:null,geography:{city:null,country:null}}),false,'sparse Jetstar confirmation must not create a standalone booking');
assert.equal(isReconstructableBookingCandidate({provider:'Uber',booking_type:'other',confirmation_reference:null,starts_at:null,geography:{city:null,country:null}}),false,'weak Uber reservation must not create a low-information booking');
assert.equal(isReconstructableBookingCandidate({provider:'Airbnb',booking_type:'accommodation',confirmation_reference:null,starts_at:'2026-08-15T00:00:00.000Z',geography:{city:'Queenstown',country:'New Zealand'}}),true,'dated geographic Airbnb reminder is reconstructable');
assert.equal(isReconstructableBookingCandidate({provider:'Hertz',booking_type:'hire_car',confirmation_reference:'L5920779422',starts_at:null,geography:{city:'Queenstown',country:'New Zealand'}}),true,'strong provider reference is reconstructable');
console.log('gmail reconstruction final safety tests passed');
