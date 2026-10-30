import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/style.css',import.meta.url),'utf8');
const card=js.split('  function businessProfileCard(){')[1]?.split('\n  function integrations(){')[0];

test('Business Profile card uses a customer-facing activation message',()=>{
 assert.ok(card,'card function must exist');
 assert.match(card,/Pendiente de activación/);
 assert.match(card,/El administrador del CRM debe habilitar el acceso/);
 assert.match(card,/business\.google\.com/);
 assert.doesNotMatch(card,/missing_config|GOOGLE_BUSINESS_PROFILE_CLIENT_ID|GOOGLE_BUSINESS_PROFILE_ENCRYPTION_KEY|GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET/);
});

test('No false active button when business profile is not configured',()=>{
 assert.match(card,/<button class="button button-primary gbp-connect-button" type="button" disabled/);
 assert.match(card,/g\.configured\?/);
 assert.match(card,/data-act="gbp-connect"/);
});

test('Business Profile card has responsive layout independent of Analytics',()=>{
 assert.match(js,/class="integration-card provider-card gbp-card"/);
 assert.match(css,/\.integration-section \.gbp-card \.gbp-head/);
 assert.match(css,/@media\(max-width:620px\).*\.gbp-card/s);
});
