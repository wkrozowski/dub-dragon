use_synth :fm

live_loop :midiSync do
  use_real_time
  ctr, test = sync "/midi:apc_key_25_0:1/control_change"
  test1 = (test <= 42)
  test2 = (test > 42) && (test <= 84)
  test3 = (test > 84)
  print test1
  print test2
  print test3
end

use_synth :fm

# Automaton definition goes here