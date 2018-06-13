<?php
    /*
    	Template Name: Homepage
    *
    *   @package Crunch
    *   @since Crunch 2.0.0
    */
?>

<?php get_header(); ?>

<main id="main" class="homepage-template">

	<section class="intro element-paddings">
		<div class="container">
			<div class="row justify-content-between">
				<div class="col-md-6">
					<div class="intro__title-wrapper">
						<h1 class="intro__title"><?php the_title(); ?></h1><!-- /.intro__title -->
					</div><!-- /.intro__title-wrapper -->
					<div class="intro__content content element-small-margin-top">
						<?php the_content(); ?>
					</div><!-- /.intro__content content element-small-margin-top -->
				</div><!-- /.col-md-6 -->
				<div class="col-md-6 text-center">
					<a href="#" class="embark-button embark-button__full-background embark-button__full-background--secondary-color element-margin-top mt-md-0">See Embark in action</a>
					<div class="intro__video-wrapper element-small-margin-top">
						<div class="video-bar text-left"><span></span><span></span><span></span></div><!-- /.video-bar text-left -->
						<?php the_field('intro_video'); ?>
					</div><!-- /.intro__video-wrapper element-small-margin-top -->
				</div><!-- /.col-md-6 text-center -->
			</div><!-- /.row justify-content-between -->
		</div><!-- /.container -->
	</section><!-- /.intro element-paddings -->

	<section class="about-what element-padding-bottom">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-what__title"><?php the_field( 'what_title' ); ?></h2><!-- /.about-what__title -->
					<div class="about-what__content content element-small-margin-top">
						<?php the_field( 'what_content' ); ?>
					</div><!-- /.about-what__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-what element-padding-bottom -->

	<section class="about-why element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-12 text-center">
					<h2 class="about-why__title"><?php the_field( 'why_title' ); ?></h2><!-- /.about-why__title -->
					<div class="about-why__content content element-small-margin-top">
						<?php the_field( 'why_content' ); ?>
					</div><!-- /.about-why__content content element-small-margin-top -->
				</div><!-- /.col-12 text-center -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-why element-paddings -->

	<section class="about-how element-padding-top">
		<div class="container">
			<div class="row">
				<div class="col-md-10 col-lg-9 mx-auto">
					<h2 class="about-how__title text-center"><?php the_field( 'how_title' ); ?></h2><!-- /.about-how__title text-center -->
					<div class="about-how__content content element-small-margin-top">
						<?php the_field( 'how_content' ); ?>
					</div><!-- /.about-how__content content element-small-margin-top -->
				</div><!-- /.col-md-10 col-lg-9 mx-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.about-how element-padding-top -->

	<section class="for-who element-padding-top">
		<div class="container">
			<div class="row justify-content-between">
				<div class="col-md-6 text-auto col-xl-auto">
					<div class="single-for text-center">

						<?php $icon = get_field( 'for_who_icon_1' ); ?>
						<?php if($icon): ?>

							<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-for__icon svg" />

						<?php endif; ?>

						<h2 class="single-for__title element-extra-small-margin-top"><?php the_field( 'for_who_title_1' ); ?></h2><!-- /.single-for__title element-extra-small-margin-top -->
						<div class="single-for__content content element-small-margin-top" data-mh="single-for-match-height">
							<?php the_field( 'for_who_content_1' ); ?>
						</div><!-- /.single-for__content content element-small-margin-top -->

						<?php if ( have_rows( 'for_who_accordion_1' ) ) : ?>

							<div class="single-for__accordion accordion text-left element-medium-margin-top" id="accordion-1">

								<?php $loop_counter = 1; ?>
								<?php while ( have_rows( 'for_who_accordion_1' ) ) : the_row(); ?>

									<div class="card">
										<div class="card-header" id="heading_one_<?= $loop_counter; ?>">
											<button class="card-header__button<?php if($loop_counter > 1) echo ' collapsed'; ?>" type="button" data-toggle="collapse" data-target="#collapse_one_<?= $loop_counter; ?>" aria-expanded="<?php if($loop_counter == 1) {echo 'true';} else {echo 'false';} ?>" aria-controls="collapse_one_<?= $loop_counter; ?>"><?php the_sub_field( 'label' ); ?></button>
										</div><!-- /#heading_one_1.card-header -->
										<div id="collapse_one_<?= $loop_counter; ?>" class="collapse<?php if($loop_counter == 1) echo ' show'; ?> accordion__collapse" aria-labelledby="heading_one" data-parent="#accordion-1">
											<div class="card-body content">
												<?php the_sub_field( 'content' ); ?>
											</div><!-- /.card-body content -->
										</div><!-- /#collapse_one_1.collapse show -->
									</div><!-- /.card -->

									<?php $loop_counter++; ?>
								<?php endwhile; ?>

							</div><!-- /#accordion-1.single-for__accordion accordion text-left element-medium-margin-top -->

						<?php endif; ?>

					</div><!-- /.single-for text-center -->
				</div><!-- /.col-md-6 text-auto col-xl-auto -->
				<div class="col-md-6 text-auto col-xl-auto">
					<div class="single-for element-margin-top mt-md-0 text-center">

						<?php $icon = get_field( 'for_who_icon_2' ); ?>
						<?php if($icon): ?>

							<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-for__icon svg" />

						<?php endif; ?>

						<h2 class="single-for__title element-extra-small-margin-top"><?php the_field( 'for_who_title_2' ); ?></h2><!-- /.single-for__title element-extra-small-margin-top -->
						<div class="single-for__content content element-small-margin-top" data-mh="single-for-match-height">
							<?php the_field( 'for_who_content_2' ); ?>
						</div><!-- /.single-for__content content element-small-margin-top -->

						<?php if ( have_rows( 'for_who_accordion_1' ) ) : ?>

							<div class="single-for__accordion accordion text-left element-medium-margin-top" id="accordion-2">

								<?php $loop_counter = 1; ?>
								<?php while ( have_rows( 'for_who_accordion_1' ) ) : the_row(); ?>

									<div class="card">
										<div class="card-header" id="heading_two_<?= $loop_counter; ?>">
											<button class="card-header__button<?php if($loop_counter > 1) echo ' collapsed'; ?>" type="button" data-toggle="collapse" data-target="#collapse_two_<?= $loop_counter; ?>" aria-expanded="<?php if($loop_counter == 1) {echo 'true';} else {echo 'false';} ?>" aria-controls="collapse_two_<?= $loop_counter; ?>"><?php the_sub_field( 'label' ); ?></button>
										</div><!-- /#heading_two_1.card-header -->
										<div id="collapse_two_<?= $loop_counter; ?>" class="collapse<?php if($loop_counter == 1) echo ' show'; ?> accordion__collapse" aria-labelledby="heading_two" data-parent="#accordion-2">
											<div class="card-body content">
												<?php the_sub_field( 'content' ); ?>
											</div><!-- /.card-body content -->
										</div><!-- /#collapse_one_1.collapse show -->
									</div><!-- /.card -->

									<?php $loop_counter++; ?>
								<?php endwhile; ?>

							</div><!-- /#accordion-2.single-for__accordion accordion text-left element-medium-margin-top -->

						<?php endif; ?>

					</div><!-- /.single-for element-margin-top mt-md-0 text-center -->
				</div><!-- /.col-md-6 text-auto col-xl-auto -->
			</div><!-- /.row justify-content-between -->
		</div><!-- /.container -->
	</section><!-- /.for-who element-padding-top -->

	<section class="key-facts element-paddings element-margin-top mt-md-0">
		<div class="container">
			<div class="row">
				<div class="col-md-6">
					<div class="row no-gutters">

						<?php $icon = get_field( 'key_facts_icon' ); ?>
						<?php if($icon): ?>

							<div class="col col-auto">
								<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="key-facts__icon svg" />
							</div><!-- /.col col-auto -->

						<?php endif; ?>

						<div class="col">
							<h2 class="key-facts__title"><?php the_field( 'key_facts_title' ); ?></h2><!-- /.key-facts__title -->
						</div><!-- /.col -->
						<div class="col-12">
							<div class="key-facts__content content element-extra-small-margin-top">
								<?php the_field( 'key_facts_content' ); ?>
							</div><!-- /.key-facts__content content element-extra-small-margin-top -->
						</div><!-- /.col-12 -->
					</div><!-- /.row no-gutters -->
				</div><!-- /.col-md-6 -->
			</div><!-- /.row -->

			<div class="row">
				<div class="col-md-6">

					<?php $image = get_field( 'key_facts_image' ); ?>
					<?php if($image): ?>

						<img src="<?= $image['url']; ?>" alt="<?= $image['alt']; ?>" class="key-facts__image element-margin-top w-100 d-md-none" />

						<svg id="Warstwa_1" class="key-facts__image element-margin-top d-none d-md-block" data-name="Warstwa 1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1351.92 833.76">
							<defs>
								<style>.cls-1{fill:#fff;}</style>
							</defs>
							<title>laptop</title>

							<image width="5633" height="4224" transform="translate(0 -180) scale(0.24)" xlink:href="<?php echo get_template_directory_uri(); ?>/images/laptop.png"/>
							<image id="image-em" x="228" y="40" width="918" height="571" xlink:href="<?= $image['url']; ?>"></image>
						</svg>

					<?php endif; ?>

					<div class="impression element-margin-top d-none d-md-block">
						<div class="impression__title-wrapper">
							<h3 class="impression__title">Leave a lasting impression</h3><!-- /.impression__title -->
						</div><!-- /.impression__title-wrapper -->
						<div class="impression__content content">
							<p>Embark will bring your customers on-board and facilitate a lasting relationship</p>
						</div><!-- /.impression__content content -->
					</div><!-- /.impression element-margin-top d-none d-md-block -->

				</div><!-- /.col-md-6 -->
				<div class="col-md-6">

					<?php if ( have_rows( 'key_facts' ) ) : ?>
						<?php while ( have_rows( 'key_facts' ) ) : the_row(); ?>

							<div class="single-fact element-medium-margin-top">
								<div class="row no-gutters">

									<?php $icon = get_sub_field( 'icon' ); ?>
									<?php if($icon): ?>

										<div class="col col-auto">
											<img src="<?= $icon['url']; ?>" alt="<?= $icon['alt']; ?>" class="single-fact__icon svg" />
										</div><!-- /.col col-auto -->

									<?php endif; ?>

									<div class="col">
										<h3 class="single-fact__title"><?php the_sub_field( 'title' ); ?></h3><!-- /.single-fact__title -->
										<div class="single-fact__content content element-extra-small-margin-top">
											<?php the_sub_field( 'content' ); ?>
										</div><!-- /.single-fact__content content element-extra-small-margin-top -->
									</div><!-- /.col -->
								</div><!-- /.row no-gutters -->
							</div><!-- /.single-fact element-medium-margin-top -->

						<?php endwhile; ?>
					<?php endif; ?>

					<div class="impression element-margin-top d-md-none">
						<div class="impression__title-wrapper">
							<h3 class="impression__title">Leave a lasting impression</h3><!-- /.impression__title -->
						</div><!-- /.impression__title-wrapper -->
						<div class="impression__content content">
							<p>Embark will bring your customers on-board and facilitate a lasting relationship</p>
						</div><!-- /.impression__content content -->
					</div><!-- /.impression element-margin-top d-md-none -->

				</div><!-- /.col-md-6 -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.key-facts element-paddings element-margin-top mt-md-0 -->

	<section class="get-in-touch text-center element-paddings">
		<div class="container">
			<div class="row">
				<div class="col-md-9 clo-lg-8 col-xl-7 mx-auto">
					<h2 class="get-in-touch__title">Find out more about Embark here<br> Get in touch</h2><!-- /.get-in-touch__title -->
					<div class="get-in-touch__content content element-small-margin-top">
						<p>Send us your details and one of our experts will get back in touch to discuss how Embark can benefit your business</p>
					</div><!-- /.get-in-touch__content content element-small-margin-top -->
					<div class="get-in-touch__form element-small-margin-top">
						<?php echo do_shortcode( '[gravityform id="1" title="false" description="false" ajax="true"]' ); ?>
					</div><!-- /.get-in-touch__form element-small-margin-top -->
				</div><!-- /.col-md-9 clo-lg-8 col-xl-7 mx-auto -->
			</div><!-- /.row -->
		</div><!-- /.container -->
	</section><!-- /.get-in-touch text-center element-paddings -->

</main><!-- /#main.homepage-template -->

<?php get_footer(); ?>