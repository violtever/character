# Security Specification — xocyberluv's character archive

## Data Invariants
1. **Public Read / Admin Write Archive**: `/characters`, `/categories`, and `/gallery` are readable by Guests, Users, and Admins. Only verified Admins (`request.auth.token.email_verified == true` and bootstrapped admin email or `/admins/{uid}`) may create, update, or delete records.
2. **Strict Role Immutability**: Standard users registering via `/users/{uid}` MUST only create documents with `role == 'user'`. Regular users can NEVER modify their `role` field or write to `/admins/{uid}`.
3. **PII Isolation**: `/users/{uid}` contains `email` and is strictly readable only by the owner (`isOwner(uid)`) or a verified Admin (`isAdmin()`). `/usernames/{username}` contains zero PII.
4. **Personal Favorites Integrity**: `/users/{uid}/favorites/{characterId}` is accessible only by the verified owner (`isOwner(uid)`), requires `userId == request.auth.uid`, and verifies that `/characters/{characterId}` exists before creation.
5. **Temporal & Structural Integrity**: All `createdAt` / `updatedAt` timestamps must equal `request.time`; `createdAt`, `uid`, and `createdBy` are immutable on update; every string and array field is bounded in size; all document keys are strictly allowlisted with `hasOnly`.
6. **Music Library & Audio Storage Integrity**: `/tracks/{trackId}` and `/tracks/{trackId}/audioChunks/{chunkId}` are publicly readable so Guests and Users can listen to archive music, while creating, editing, replacing audio, and deleting are strictly restricted to verified Admins (`isAdmin()`). Audio chunks are immutable (`allow update: if false`), bounded to `<= 600,000` chars per chunk and `<= 40` chunks, require `exists(/tracks/{trackId})`, and enforce `resource.data.trackId == trackId` on `list`.
7. **Forum Authorization & Anti-Spoofing**: `/forumPosts/{postId}`, `/forumComments/{commentId}`, and `/forumLikes/{likeId}` are publicly readable by Guests/Users/Admins. Only verified authenticated accounts may create posts, comments, or likes. Regular Users can NEVER set `authorRole: 'admin'`, `isPinned: true`, `pinnedAt > 0`, `pinOrder > 0`, or `isFeatured: true` on create or update — those privileges are strictly enforced by `isAdmin()` in Firestore rules. Users may only edit/delete their own posts, comments, and likes; Admins may pin, feature, or delete any post/comment.
8. **Profile Immutability & PII Split**: Users editing `/users/{uid}` and `/publicProfiles/{uid}` may ONLY mutate `displayName`, `photoURL`, and `updatedAt`. `username`, `email`, `uid`, and `role` are strictly immutable for non-Admin owners. `/publicProfiles/{uid}` contains zero PII (no `email`).

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Guest Forum Write**: Unauthenticated `POST /forumPosts/POST-1` or `POST /forumComments/CMT-1` → Denied.
2. **User Privilege Escalation on Signup**: Authenticated user creating `/users/{uid}` or `/publicProfiles/{uid}` with `{ role: "admin" }` → Denied.
3. **User Self-Upgrade or Username/Email Tampering on Profile Update**: Authenticated user updating `/users/{uid}` changing `role`, `username`, or `email` → Denied.
4. **User Admin Role Spoofing in Forum**: Regular user creating `/forumPosts/POST-2` or `/forumComments/CMT-2` with `{ authorRole: "admin" }` → Denied.
5. **User Pin / Feature Escalation**: Regular user creating or updating `/forumPosts/POST-3` with `{ isPinned: true }` or `{ isFeatured: true }` → Denied.
6. **Email Spoofing Admin**: Unverified token (`email_verified: false`) matching admin email attempting to pin `/forumPosts/POST-1` or create `/tracks/TRK-001` → Denied.
7. **Cross-User Post / Comment Mutation**: Regular user `userA` attempting to edit or delete `userB`'s post or comment → Denied.
8. **Shadow Field Injection**: Any user creating `/forumPosts/POST-4` with ghost field `bypassModeration: true` → Denied by `hasOnly`.
9. **ID Poisoning & Like Spoofing**: User creating `/forumLikes/POST-1_otherUid` or `/forumPosts/../../bad` → Denied by `isValidId` and `likeId == postId + '_' + request.auth.uid`.
10. **Orphaned Comment / Like / Audio Chunk**: Creating `/forumComments/CMT-X` or `/forumLikes/NONEXIST_uid` referencing a non-existent post → Denied by `exists(/forumPosts/...)`.
11. **Timestamp Forgery**: Creating `/forumPosts/POST-5` with client-forged `createdAt: 2020-01-01` → Denied by `createdAt == request.time`.
12. **Oversized Payload / Value Poisoning**: Submitting >10,000-char post content, >250KB avatar/image, or mutating an immutable `/forumLikes` doc → Denied by validation helpers.
