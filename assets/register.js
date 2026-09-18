const API_BASE="";

 

const form=document.getElementById("registerForm");

const state=document.getElementById("registerState");



 

function setState(message){

  if(state) state.textContent=message;

}

 

if(form){

  form.addEventListener("submit",async event=>{

    event.preventDefault();

 

    if(!form.checkValidity()){

      form.reportValidity();

      return;

    }

 

    setState("Creating account…");

 

    const data=Object.fromEntries(

      new FormData(form).entries()

    );

 

    data.ageConfirmed=form.ageConfirmed.checked;

    data.termsAccepted=form.termsPrivacyAccepted.checked;

    data.privacyAccepted=form.termsPrivacyAccepted.checked;

    data.marketingConsent=false;

 

    try{

      const response=await fetch(

        API_BASE+"/api/register",

        {

          method:"POST",

          headers:{

            "content-type":"application/json",

            "accept":"application/json"

          },

          body:JSON.stringify(data)

        }

      );

 

      const result=await readJson(response);

 

      if(!response.ok){

        throw new Error(

          result.message||

          (

            result.error==="email_exists"

              ?"An account with this email already exists."

              :

            result.error==="rate_limited"

              ?"Too many registration attempts. Please try again later."

              :

            result.error==="validation_failed"

              ?"Please complete the required fields and accept the required terms."

              :

            "Account creation failed. Please try again."

          )

        );

      }

 

      setState(

        "Account created. Email verification is required before activation."

      );

 

      form.reset();

 

      if(refStatus){

        refStatus.textContent="";

      }

 

    }catch(error){

      setState(

        error?.message||

        "Account creation failed. Please try again."

      );

    }

  });

}
