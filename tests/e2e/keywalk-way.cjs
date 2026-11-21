// The way the `keywalk` scenario walks with W, A, D and Shift alone (#295, group C): from before the gate up the court to the great hall, round the hall's
// platform and back to its front. The scenario's hands only turn toward the next point; they never go round what stands in the way (#349), so each leg runs
// clear of everything the floor is shut for: north of the two young evergreens before the hall ((-15.5, 1.8), (15.5, 1.8): shut 1.25 m round each, #531),
// and behind the hall's court along the lane that bends between the tread-feet of its stair (x ±3, from z -29.5) and the row of posts before it (x ±7, ±11).
// The points were found on the baked floor (a path of at least half a metre's room, pulled taut to 0.4 m) and `tests/unit/keywalk-way.test.mjs` holds every leg 0.3 m clear.
module.exports = [[0, 1], [-5.2, -0.3], [-19.5, -1.5], [-19.5, -29], [-4.2, -29.1], [-3.5, -28.7], [5.7, -28.8], [6.2, -29.2], [19.5, -29], [19.5, -1.5], [1.4, 0.1], [0, 1.5]];
