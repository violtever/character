# Security Specification — xocyberluv's character archive

## Data Invariants
1. **Public Read / Admin Write Archive**: `/characters`, `/categories`, and `/gallery` are readable by Guests, Users, and Admins. Only verified Admins (`request.auth.token.email_verified == true` and bootstrapped admin email or `/admins/{uid}`) may create, update, or delete records.
2. **Strict Role Immutability**: Standard users registering via `/users/{uid}` MUST only create documents with `role == 'user'`. Regular users can NEVER modify their `role` field or write to `/admins/{uid}`.
3. **PII Isolation**: `/users/{uid}` contains `email` and is strictly readable only by the owner (`isOwner(uid)`) or a verified Admin (`isAdmin()`). `/usernames/{username}` contains zero PII.
4. **Personal Favorites Integrity**: `/users/{uid}/favorites/{characterId}` is accessible only by the verified owner (`isOwner(uid)`), requires `userId == request.auth.uid`, and verifies that `/characters/{characterId}` exists before creation.
5. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`; `createdAt`, `uid`, and `createdBy` are immutable on update; every string and array field is bounded in size; all document keys are strictly allowlisted with `hasOnly`.
6. **Music Library & Audio Storage Integrity**: `/tracks/{trackId}` and `/tracks/{trackId}/audioChunks/{chunkId}` are publicly readable so Guests and Users can listen to archive music, while creating, editing, replacing audio, and deleting are strictly restricted to verified Admins (`isAdmin()`). Audio chunks are immutable (`allow update: if false`), bounded to `<= 600,000` chars per chunk and `<= 40` chunks, require `exists(/tracks/{trackId})`, and enforce `resource.data.trackId == trackId` on `list`.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Guest Character Create**: Unauthenticated `POST /characters/ARC-999` → Denied.
2. **User Privilege Escalation on Signup**: Authenticated user creating `/users/{uid}` with `{ role: "admin" }` → Denied.
3. **User Self-Upgrade on Update**: Authenticated user updating `/users/{uid}` changing `role: "admin"` → Denied.
4. **User Admin Allowlist Injection**: Authenticated user writing `/admins/{uid}` → Denied.
5. **Email Spoofing Admin**: Unverified token (`email_verified: false`) matching admin email attempting to create `/characters/ARC-100` or `/tracks/TRK-001` → Denied.
6. **User Character / Track Mutation**: Verified `user` attempting to upload, update, or delete `/characters/ARC-001`, `/tracks/TRK-001`, or `/tracks/TRK-001/audioChunks/c0` → Denied.
7. **Shadow Field Injection**: Admin creating `/characters/ARC-009` or `/tracks/TRK-002` with extra ghost field `isSystemOverride: true` → Denied by `hasOnly`.
8. **ID Poisoning**: Creating `/characters/../../etc/passwd` or `/tracks/bad id!` → Denied by `isValidId`.
9. **Cross-User PII Read**: Verified `userA` attempting `get /users/userB` or `list /users` → Denied.
10. **Orphaned Favorite / Orphaned Audio Chunk**: Creating `/users/{uid}/favorites/NON_EXISTENT` or `/tracks/NON_EXISTENT/audioChunks/v1_0` → Denied by `exists(...)`.
11. **Timestamp Forgery**: Admin creating `/tracks/TRK-003` with client-forged `createdAt: 2020-01-01` → Denied by `createdAt == request.time`.
12. **Array Overflow / Chunk Poisoning**: Admin writing oversized audio chunk (`> 600,000` chars), negative `audioFileSize`, or updating an immutable audio chunk → Denied by `isValidTrack` / `isValidTrackAudioChunk` / `allow update: if false`.
