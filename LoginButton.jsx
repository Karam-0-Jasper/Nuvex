import { auth, provider, signInWithPopup } from "./firebase";

export default function LoginButton() {
  const handleSignIn = () => {
    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("Signed in:", result.user);
        alert("Signed in as " + result.user.displayName);
      })
      .catch((error) => {
        console.error("Login error:", error);
      });
  };

  return (
    <button onClick={handleSignIn}>
      Sign in with Google
    </button>
  );
}
