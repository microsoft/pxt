
import "mocha";
import * as chai from "chai";

describe('Array', function () {
    describe('#indexOf()', function () {
        it('should return -1 when the value is not present', function () {
            chai.assert.equal([1, 2, 3].indexOf(4), -1);
        });
    });
})