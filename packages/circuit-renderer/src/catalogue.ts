import { ArduinoUno, Breadboard, breadboardPins, unoPins } from './models/boards';
import { Led, Oled, Potentiometer, Pushbutton, Resistor, Servo } from './models/parts';
import type { ComponentRegistry } from './types';

export const builtinComponents: ComponentRegistry = {
  'arduino-uno': { kind:'arduino-uno', label:'Arduino Uno', size:[74,13,54], pins:unoPins, Model:ArduinoUno },
  breadboard: { kind:'breadboard', label:'Breadboard · 400 contacts', size:[83,10,55], pins:breadboardPins, Model:Breadboard },
  led: { kind:'led', label:'LED · 5 mm', size:[6,11,6], pins:[{id:'A',position:[-1.27,0.5,0]},{id:'C',position:[1.27,0.5,0]}], Model:Led },
  resistor: { kind:'resistor', label:'Axial resistor', size:[15,4.5,3], pins:[{id:'1',position:[-7,0.5,0]},{id:'2',position:[7,0.5,0]}], Model:Resistor },
  pushbutton: { kind:'pushbutton', label:'Tactile button', size:[10,7,7], pins:[{id:'1.l',position:[-3.8,0.8,-2.25]},{id:'1.r',position:[3.8,0.8,-2.25]},{id:'2.l',position:[-3.8,0.8,2.25]},{id:'2.r',position:[3.8,0.8,2.25]}], Model:Pushbutton, input:'momentary' },
  potentiometer: { kind:'potentiometer', label:'Rotary potentiometer', size:[12,12,18], pins:[{id:'VCC',position:[-2.54,0.6,8],role:'power'},{id:'SIG',position:[0,0.6,8]},{id:'GND',position:[2.54,0.6,8],role:'ground'}], Model:Potentiometer, input:'analogue' },
  servo: { kind:'servo', label:'Micro servo', size:[34,30,26], pins:[{id:'PWM',position:[-11,2,-2]},{id:'V+',position:[-11,2,0],role:'power'},{id:'GND',position:[-11,2,2],role:'ground'}], Model:Servo },
  oled: { kind:'oled', label:'OLED display', size:[27,5,28], pins:[{id:'GND',position:[-3.81,4,12],role:'ground'},{id:'VCC',position:[-1.27,4,12],role:'power'},{id:'SCL',position:[1.27,4,12]},{id:'SDA',position:[3.81,4,12]}], Model:Oled },
};
