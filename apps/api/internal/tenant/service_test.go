package tenant

import "testing"

func TestSlugFromEmail(t *testing.T) {
	cases := map[string]string{
		"alice@example.com":                "alice",
		"first.last+tag@corp.io":           "first-lasttag",
		"UPPER@case.com":                   "upper",
		"":                                 "user",
		"verylongusername1234567890@x.io":  "verylongusername1234",
	}
	for in, want := range cases {
		if got := slugFromEmail(in); got != want {
			t.Errorf("slugFromEmail(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestSha256HexStable(t *testing.T) {
	if got := sha256Hex("hello"); got != "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824" {
		t.Errorf("unexpected sha256 hex: %s", got)
	}
}

func TestRandomAlphanumericLen(t *testing.T) {
	for _, n := range []int{1, 8, 32, 64} {
		s := randomAlphanumeric(n)
		if len(s) != n {
			t.Errorf("len = %d, want %d", len(s), n)
		}
		for _, r := range s {
			if !(r >= 'a' && r <= 'z') && !(r >= '0' && r <= '9') {
				t.Errorf("non-alphanum rune %q in %q", r, s)
			}
		}
	}
}
