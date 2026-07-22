import successImage from "../../../assets/auth/success.svg";

import Modal from "../common/Modal";

type SuccessModalProps = {
  title?: string;
  description?: string;
  buttonText?: string;
  onContinue: () => void;
};

export default function SuccessModal({
  title = "Account Created",
  description = `Congratulations!

Your MonteSkolar account has been successfully created.

You can now login using your Student Number and Password.`,
  buttonText = "Continue to Login",
  onContinue,
}: SuccessModalProps) {
  return (
    <Modal onClose={onContinue} maxWidth="max-w-sm sm:max-w-md">
      <div className="mx-auto flex max-w-sm sm:max-w-md flex-col items-center">
        <img
          src={successImage}
          alt="Success"
          className="h-28 w-28 sm:h-36 sm:w-36 md:h-44 md:w-44"
        />

        <h1 className="mt-4 text-2xl font-bold sm:text-3xl md:mt-8">{title}</h1>

        <p className="mt-3 whitespace-pre-line text-center text-sm text-gray-500 leading-6 sm:mt-4 sm:text-base sm:leading-7">
          {description}
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="
          mt-6 sm:mt-10
          h-12
          w-full
          rounded-xl
          bg-[#006400]
          text-white
          font-semibold
          transition
          hover:bg-[#005000]
          active:scale-95
          "
        >
          {buttonText}
        </button>
      </div>
    </Modal>
  );
}
