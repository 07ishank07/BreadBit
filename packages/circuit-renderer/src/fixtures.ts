import type { CircuitDocument, SimulationSnapshot } from './types';

/** Presentation fixture only. No electrical simulation or correctness is implied. */
export const workbenchFixture: CircuitDocument = {
  parts:[
    {id:'uno',kind:'arduino-uno',label:'Arduino Uno',position:[-63,0,0]},
    {id:'bb',kind:'breadboard',label:'Breadboard',position:[25,0,3],locked:true},
    {id:'led',kind:'led',label:'Status LED',position:[-1,10,10],properties:{color:'#ff6e4a'}},
    {id:'r1',kind:'resistor',label:'220 Ω',position:[14,10,11]},
    {id:'button',kind:'pushbutton',label:'Input',position:[36,10,10]},
    {id:'pot',kind:'potentiometer',label:'10 kΩ',position:[52,10,-8]},
    {id:'screen',kind:'oled',label:'OLED',position:[18,10,-12]},
    {id:'servo',kind:'servo',label:'Servo',position:[87,0,5]},
  ],
  wires:[
    {id:'signal',from:{partId:'uno',pinId:'13'},to:{partId:'r1',pinId:'1'},color:'#eebc68',lift:15},
    {id:'resistor-led',from:{partId:'r1',pinId:'2'},to:{partId:'led',pinId:'A'},color:'#f09878',lift:8},
    {id:'ground-led',from:{partId:'led',pinId:'C'},to:{partId:'bb',pinId:'bn3'},color:'#839ba9',lift:5},
    {id:'ground',from:{partId:'uno',pinId:'GND.1'},to:{partId:'bb',pinId:'bn1'},color:'#61788a',lift:7},
    {id:'button-input',from:{partId:'uno',pinId:'2'},to:{partId:'button',pinId:'1.l'},color:'#8bd8b1',lift:19},
    {id:'scl',from:{partId:'uno',pinId:'A5'},to:{partId:'screen',pinId:'SCL'},color:'#b6a4e7',lift:12},
    {id:'servo-pwm',from:{partId:'pot',pinId:'SIG'},to:{partId:'servo',pinId:'PWM'},color:'#95d4d4',lift:10},
  ],
};
export const fixtureSnapshot: SimulationSnapshot = {
  parts:{led:{brightness:0.85},uno:{brightness:0.7},screen:{displayLines:['SYSTEM READY','24.8 °C']},pot:{value:0.6},servo:{angle:35}},
  activeWireIds:['signal'],
};
