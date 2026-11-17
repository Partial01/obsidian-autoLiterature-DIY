class PatternRecognizer {
    private _pattern: RegExp;
    private _flags: string = 'g'

    set pattern(pattern: string) {
        this._pattern = new RegExp(pattern, this._flags);
    }

    constructor(pattern: string) {
        this._pattern = new RegExp(pattern, this._flags);
    }

    match(input: string): RegExpMatchArray | null {
        return input.match(this._pattern);
    }

    findAll(input: string): RegExpExecArray[] | null {
        const matches: RegExpExecArray[] = [];
        let match: RegExpExecArray | null;
		this._pattern.lastIndex = 0;

        while ((match = this._pattern.exec(input)) !== null) {
            matches.push(match);
			if (!match[0].length) this._pattern.lastIndex++;
        }
        return matches;
    }
}

export default PatternRecognizer;
