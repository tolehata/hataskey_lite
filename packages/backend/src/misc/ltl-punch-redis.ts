/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// All state transitions, including awards, are committed together. No client clock is used.
export const LTL_PUNCH_SCRIPT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local operation = ARGV[1]
local user = ARGV[3]
local changed = false
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 15000)
local raw = redis.call('GET', KEYS[1])
local state = raw and cjson.decode(raw) or nil
local function finish(status)
 state.status = status
 state.finishedAt = status == 'escaped' and state.endsAt or now
 state.revision = state.revision + 1
 changed = true
 local participants = redis.call('SMEMBERS', KEYS[3])
 local award = status == 'won' and 'ltlPunchVictory' or 'ltlPunchDefeat'
 for _, participant in ipairs(participants) do
  redis.call('HSET', KEYS[4], state.id .. ':' .. participant, cjson.encode({userId=participant,type=award}))
 end
 redis.call('DEL', KEYS[3], KEYS[5], KEYS[6])
end
if state and state.status == 'active' and now >= state.endsAt then finish('escaped') end
if operation == 'sync' then
 redis.call('ZADD', KEYS[2], now, user)
 redis.call('PEXPIRE', KEYS[2], 30000)
 if state and state.status == 'active' then redis.call('SADD', KEYS[3], user) end
end
local people = redis.call('ZCARD', KEYS[2])
if state and state.status == 'active' and state.people ~= people then
 local maximum = 80 + 20 * math.max(1, people)
 state.hp = math.max(1, math.floor(state.ratio * maximum + 0.5))
 state.maxHp = maximum
 state.people = people
 state.revision = state.revision + 1
 changed = true
end
local started = false
if operation == 'start' and (not state or (state.status ~= 'active' and now >= state.finishedAt + 60000)) then
 local day = tostring(math.floor(now / 86400000))
 local storedDay = redis.call('HGET', KEYS[7], 'day')
 local count = storedDay == day and tonumber(redis.call('HGET', KEYS[7], 'count') or '0') or 0
 if count < 2 then
  redis.call('HSET', KEYS[7], 'day', day, 'count', count + 1)
  redis.call('PEXPIRE', KEYS[7], 172800000)
  redis.call('DEL', KEYS[3], KEYS[5], KEYS[6])
  local participants = redis.call('ZRANGE', KEYS[2], 0, -1)
  for _, participant in ipairs(participants) do redis.call('SADD', KEYS[3], participant) end
  local maximum = 80 + 20 * math.max(1, people)
  state = {id=ARGV[4],revision=1,startedAt=now,fallAt=now+3200,endsAt=now+39200,finishedAt=cjson.null,status='active',hp=maximum,maxHp=maximum,people=people,ratio=1}
  changed = true
  started = true
 end
end
if operation == 'attack' and state and state.status == 'active' and state.id == ARGV[4] and now >= state.fallAt and now < state.endsAt then
 local present = redis.call('ZSCORE', KEYS[2], user)
 local last = tonumber(redis.call('HGET', KEYS[5], user) or '-1000')
 local request = user .. ':' .. ARGV[5]
 if present and now - last >= 125 and redis.call('SISMEMBER', KEYS[6], request) == 0 then
  redis.call('HSET', KEYS[5], user, now)
  redis.call('SADD', KEYS[6], request)
  redis.call('SADD', KEYS[3], user)
  state.hp = math.max(0, state.hp - 8)
  state.ratio = state.hp / state.maxHp
  state.revision = state.revision + 1
  changed = true
  if state.hp == 0 then finish('won') end
 end
end
if state then
 state.serverNow = now
 redis.call('SET', KEYS[1], cjson.encode(state))
end
return cjson.encode({state=state or cjson.null,changed=changed,started=started})
`;
