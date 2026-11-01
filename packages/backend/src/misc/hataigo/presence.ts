/*
 * SPDX-FileCopyrightText: Tolehata and hatasaba-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

/**
 * Presence contains session tokens internally; only the distinct spectator count leaves Redis.
 * Returns {count, changed}: `changed` is 1 only when a join/leave moved the count away from the last one announced,
 * so steady heartbeats do not fan a count event out to every subscriber. 'read' never touches the announced count.
 */
export const hataigoPresenceScript = `
local key=KEYS[1]
redis.call('ZREMRANGEBYSCORE',key,'-inf',ARGV[1])
if ARGV[4]=='leave' then redis.call('ZREM',key,ARGV[3]) elseif ARGV[4]=='join' then redis.call('ZADD',key,ARGV[2],ARGV[3]) end
redis.call('PEXPIRE',key,90000)
local seen={}
local n=0
for _,member in ipairs(redis.call('ZRANGE',key,0,-1)) do
 local identity=string.match(member,'^([^:]+):')
 if identity and not seen[identity] then seen[identity]=true;n=n+1 end
end
if ARGV[4]=='read' then return {n,0} end
local announced=redis.call('GET',KEYS[2])
redis.call('SET',KEYS[2],n,'PX',90000)
if announced==tostring(n) then return {n,0} end
return {n,1}
`;
/** Both keys share a hash tag so the script stays valid on a slot-partitioned Redis. */
export function hataigoPresenceKeys(gameId: string): [string, string] { return [`hataigo:presence:{${gameId}}`, `hataigo:presence:{${gameId}}:announced`]; }
export function parseHataigoPresence(raw: unknown): { count: number; changed: boolean } | null {
	if (!Array.isArray(raw)) return null;
	const count = Number(raw[0]);
	return Number.isSafeInteger(count) && count >= 0 ? { count, changed: Number(raw[1]) === 1 } : null;
}
export const hataigoReactions = ['👏', '😮', '🤔', '😂', '🔥', '🙏'] as const;
export function isHataigoReaction(value: unknown): value is typeof hataigoReactions[number] { return typeof value === 'string' && (hataigoReactions as readonly string[]).includes(value); }
