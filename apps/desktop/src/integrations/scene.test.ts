import {describe,it,expect} from 'vitest';
import {moveInLayout,wireExists} from './scene';
import {shortcut} from './shortcuts';
describe('shared 3D editing boundary',()=>{
 it('maps a 3D drag back to the original 2D offsets',()=>{expect(moveInLayout({id:'r',kind:'resistor',position:[30,0,40]},[32,0,36],{x:113,y:79})).toEqual({x:123,y:59});});
 it('rejects nonfinite coordinates',()=>expect(()=>moveInLayout({id:'r',kind:'resistor',position:[0,0,0]},[NaN,0,0],{x:0,y:0})).toThrow());
 it('rejects reverse duplicate wires and self connections',()=>{const a={componentId:'led',pinName:'A'},b={componentId:'uno',pinName:'13'};expect(wireExists([{start:a,end:b}],b,a)).toBe(true);expect(wireExists([],a,a)).toBe(true);expect(wireExists([],a,b)).toBe(false);});
 it('leaves native text undo alone but handles workspace undo and redo',()=>{expect(shortcut('z',true,false,false,true)).toBeNull();expect(shortcut('z',true,false,false,false)).toBe('undo');expect(shortcut('z',false,true,true,false)).toBe('redo');expect(shortcut('y',true,false,false,false)).toBe('redo');expect(shortcut('s',true,false,true,true)).toBe('saveAs');expect(shortcut('o',true,false,false,false)).toBe('open');});
});
