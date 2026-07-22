import Spinner from "./Spinner";


type LoadingButtonProps={
children:React.ReactNode;
loading:boolean;
};


export default function LoadingButton({
children,
loading
}:LoadingButtonProps){

return(

<button
disabled={loading}
className="
h-12
w-full
rounded-xl
bg-[#006400]
text-white
font-semibold
flex
items-center
justify-center
gap-3
disabled:opacity-50
"
>

{
loading ?
<>
<Spinner/>
Processing...
</>
:
children
}

</button>


)

}