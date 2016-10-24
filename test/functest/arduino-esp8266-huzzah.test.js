import test from 'ava';
import gulp from 'gulp';
import arduino from '../../arduino-esp8266-huzzah';


test('Arduino gulp tasks', () => {
  arduino(gulp, {});
}); 