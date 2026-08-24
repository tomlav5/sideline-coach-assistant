drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Allow all storage operations for authenticated users"
  on "storage"."objects"
  as permissive
  for all
  to authenticated
using (true)
with check (true);



  create policy "Club admins can delete their assets"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'club-assets'::text) AND (EXISTS ( SELECT 1
   FROM (public.clubs c
     JOIN public.club_members cm ON ((c.id = cm.club_id)))
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND (cm.user_id = auth.uid()) AND (cm.role = 'admin'::public.user_role))))));



  create policy "Club admins can update their assets"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'club-assets'::text) AND (EXISTS ( SELECT 1
   FROM (public.clubs c
     JOIN public.club_members cm ON ((c.id = cm.club_id)))
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND (cm.user_id = auth.uid()) AND (cm.role = 'admin'::public.user_role))))));



  create policy "Club admins can upload assets"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'club-assets'::text) AND (EXISTS ( SELECT 1
   FROM (public.clubs c
     JOIN public.club_members cm ON ((c.id = cm.club_id)))
  WHERE (((c.id)::text = (storage.foldername(c.name))[1]) AND (cm.user_id = auth.uid()) AND (cm.role = 'admin'::public.user_role))))));



  create policy "Club assets are publicly accessible"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'club-assets'::text));



  create policy "Public read access to club assets"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'club-assets'::text));



