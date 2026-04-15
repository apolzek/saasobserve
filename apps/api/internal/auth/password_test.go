package auth

import "testing"

func TestPasswordRoundTrip(t *testing.T) {
	hash, err := HashPassword("hunter2")
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	if hash == "hunter2" {
		t.Fatal("hash returned plaintext")
	}
	if !CheckPassword(hash, "hunter2") {
		t.Fatal("correct password rejected")
	}
	if CheckPassword(hash, "hunter3") {
		t.Fatal("wrong password accepted")
	}
}

func TestCheckPasswordEmptyHash(t *testing.T) {
	if CheckPassword("", "anything") {
		t.Fatal("empty hash should never match")
	}
}
